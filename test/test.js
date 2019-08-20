const request = require('supertest');//Router オブジェクトをテストするモジュール
const app = require('../app');
// モジュール単体テストをするmochaというテスティングフレームワーク使用
const passportStub = require('passport-stub');//ログインした時には /login にユーザー名が表示されることをテスト
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');

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
        .send({ schedulename: 'テスト予定１', memo: 'テストメモ1\r\nテストメモ2', candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3' })
        .expect('Location', /schedules/)
        .expect(302)//詳細ページへリダイレクト
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          request(app)
            .get(createdSchedulePath)
            .expect(/テスト予定１/)//予定と候補が表示される
            .expect(/テストメモ1/)//正規表現 レスポンスに含まれる文字列がある場合はテストを成功
            .expect(/テストメモ2/)
            .expect(/テスト候補1/)
            .expect(/テスト候補2/)
            .expect(/テスト候補3/)
            .expect(200)//予定表示ページのアクセスが２００
            .end((err, res) => {//テスト終わったら
              const scheduleId = createdSchedulePath.split('/schedules/')[1];
              Candidate.findAll({
                where: { schedule_id: scheduleId }
              }).then((candidates) => {//テスト終了後テストで作成されたユーザー以外のデータを削除する処理
                candidates.forEach((c) => { c.destroy(); });
                Schedule.findById(scheduleId).then((s) => { s.destroy(); });// findByPk 関数は、モデルに対応するデータを主キーによって 1 行だけ取得
              });
              if(err) return done(err);
              done();
            });
        });
    });
  });
});