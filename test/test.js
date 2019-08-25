const request = require('supertest');//Router オブジェクトをテストするモジュール
const assert = require('assert');
const app = require('../app');
// モジュール単体テストをするmochaというテスティングフレームワーク使用
const passportStub = require('passport-stub');//ログインした時には /login にユーザー名が表示されることをテスト
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const Availability = require('../models/availability');

describe('/login', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
  });
  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  })
  it('ログインのためのリンクが含まれる', (done) => {
    request(app)
    .get('/login')
    .expect('Content-Type', 'text/html; charset=utf-8')
    .expect(/<a href="\/auth\/github"/)//expect 関数に、正規表現を一つ渡すと、 HTML の body 内にその正規表現が含まれるかをテストする。
    .expect(200, done);//期待されるステータスコードの整数と、テスト自体の引数に渡される done 関数
  });
  /* テスト内容
  ・レスポンスヘッダの 'Content-Type' が text/html; charset=utf-8 であること
  ・<a href="/auth/github" が HTML に含まれること
  ・ステータスコードが 200 OK で返る
  */

  it('ログイン時はユーザー名が表示される', (done) => {
    request(app)
      .get('/login')
      .expect(/testuser/)//HTML の body 内に、 testuser という文字列が含まれる
      .expect(200, done);
  });
});

describe('/logout', () => {
  it('ログアウト後/にリダイレクトされる', (done) => {
    request(app)
      .get('/logout')
      .expect('Location', '/')
      .expect(302, done);//リダイレクト
  });
});

//予定の作成、表示されるテスト
describe('/schedules', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });
  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定作成でき、表示される', (done) => {
    User.upsert({ user_id: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ schedulename: 'テスト予定1', memo: 'テストメモ1\r\nテストメモ2', candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3' })
        .expect('Location', /schedules/)
        .expect(302)//詳細ページへリダイレクト
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          request(app)
            .get(createdSchedulePath)
            .expect(/テスト予定1/)//予定と候補が表示される
            .expect(/テストメモ1/)//正規表現 レスポンスに含まれる文字列がある場合はテストを成功
            .expect(/テストメモ2/)
            .expect(/テスト候補1/)
            .expect(/テスト候補2/)
            .expect(/テスト候補3/)
            .expect(200)//予定表示ページのアクセスが２００
            .end((err, res) => { deleteScheduleAggregate(createdSchedulePath.split('/schedules/')[1], done, err);});
        });                     //テストで作成した予定と、紐づく情報を削除するメソッドを呼び出してる
    });
  });
});
// 出欠が更新できる
describe('/schedules/:schedule_id/users/:user_id/candidates/:candidate_id', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('出欠が更新できる', (done) => {
    User.upsert({ user_id: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ schedulename: 'テスト出欠更新予定1', memo: 'テスト出欠更新メモ1', candidates: 'テスト出欠更新候補1' })//schedules に POST を行い「予定」と「候補」を作成
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          Candidate.findOne({//予定に関する候補を取得
            where: { schedule_id: scheduleId }
          }).then((candidate) => {
            // 更新がされることをテスト
            request(app)
            .post(`/schedules/${scheduleId}/users/${0}/candidates/${candidate.candidate_id}`)
            .send({ availability: 2 }) // 出席に更新
            .expect('{"status":"OK","availability":2}')
            .end((err, res) => {
              Availability.findAll({
                where: { schedule_id: scheduleId }
              }).then((availabilities) => {
                assert.equal(availabilities.length, 1);
                assert.equal(availabilities[0].availability, 2);
                deleteScheduleAggregate(scheduleId, done, err);
              });//予定に関連する出欠情報がひとつあることと、その内容が更新された `2` であること
            });
          });
        });
    });
  });
});
// Aggregate:集約, deleteScheduleAggregate特定の親のデータモデルが他のデータモデルを所有
function deleteScheduleAggregate(scheduleId, done, err) {
  Availability.findAll({//出欠全て取得からの削除
    where: { schedule_id: scheduleId }
  }).then((availabilities) => {
    const promises = availabilities.map((a) => { return a.destroy(); });//子から消していくことでデータベースの処理不都合を防止する
    Promise.all(promises).then(() => {
      Candidate.findAll({
        where: { schedule_id: scheduleId }
      }).then((candidates) => {
        const promises = candidates.map((c) => { return c.destroy(); });//候補
        Promise.all(promises).then(() => {
          Schedule.findById(scheduleId).then((s) => { s.destroy(); });//親予定
          if (err) return done(err);
          done();
        });
      });
    });
  });
}