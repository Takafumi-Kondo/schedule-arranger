const request = require('supertest');//Router オブジェクトをテストするモジュール
const assert = require('assert');
const app = require('../app');
// モジュール単体テストをするmochaというテスティングフレームワーク使用
const passportStub = require('passport-stub');//ログインした時には /login にユーザー名が表示されることをテスト
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const Availability = require('../models/availability');
const Comment = require('../models/comment');
const deleteScheduleAggregate = require('../routes/schedules').deleteScheduleAggregate;

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
//コメントが更新できるか
describe('/schedules/:schedule_id/users/:user_id/comments', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('コメントが更新できる', (done) => {
    User.upsert({ user_id: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ schedulename: 'テストコメント更新予定1', memo: 'テストコメント更新メモ1', candidates: 'テストコメント更新候補1' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          //更新がされることをテスト
          const userId = 0;
          request(app)
            .post(`/schedules/${scheduleId}/users/${userId}/comments`)
            .send({ comment: 'testcomment' })
            .expect('{"status":"OK","comment":"testcomment"}')
            .end((err, res) => {
              Comment.findAll({
                where: { schedule_id: scheduleId }
              }).then((comments) => {
                assert.equal(comments.length, 1);
                assert.equal(comments[0].comment, 'testcomment');
                deleteScheduleAggregate(scheduleId, done, err);
              });
            });
        });
    });
  });
});

describe('/schedules/:schedule_id?edit=1', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id:0, username: 'testuser'});
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定が更新でき、候補が追加できる', (done) => {
    User.upsert({ user_id: 0, username: 'username'}).then(() => {
      request(app)
        .post('/schedules')
        .send({ schedulename: 'テスト更新予定1', memo: 'テスト更新メモ1', candidates: 'テスト更新候補1' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          //更新されるかテスト
          request(app)
            .post(`/schedules/${scheduleId}?edit=1`)
            .send({ schedulename: 'テスト更新予定2', memo: 'テスト更新メモ2', candidates: 'テスト更新候補2' })
            .end((err, res) => {
              Schedule.findByPk(scheduleId).then((s) => {//予定追加されたか
                assert.equal(s.schedulename, 'テスト更新予定2');
                assert.equal(s.memo, 'テスト更新メモ2');
              });
              Candidate.findAll({//候補が追加されたか
                where: { schedule_id: scheduleId },
                order: [['"candidate_id"', 'ASC']]
              }).then((candidates) => {
                assert.equal(candidates.length, 2);
                assert.equal(candidates[0].candidateName, 'テスト更新候補1');
                assert.equal(candidates[1].candidateName, 'テスト更新候補2');
                deleteScheduleAggregate(scheduleId, done, err);
              });
            });
        });
    });
  });
});

//function deleteScheduleAggregate 〜〜を削除 routes/schedules.jsのを使えるようにあしてるので

describe('/schedules/:scheduleId?delete=1', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定に関する全ての情報が削除できる', (done) => {
    User.upsert({ user_id: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ schedulename: 'テスト更新予定1', memo: 'テスト更新メモ1', candidates: 'テスト更新候補1' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];

          //出欠作成
          const promiseAvailability = Candidate.findOne({
            where: { schedule_id: scheduleId }
          }).then((candidate) => {
            return new Promise((resolve) => {
              const userId = 0;
              request(app)
                .post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidate.candidate_id}`)
                .send({ availability: 2 })//出席に更新
                .end((err, res) => {
                  if (err) done(err);
                  resolve();
                });
            });
          });

          // コメント作成
          const promiseComment = new Promise((resolve) => {
            const userId = 0;
            request(app)
              .post(`/schedules/${scheduleId}/users/${userId}/comments`)
              .send({ comment: 'testcomment' })
              .expect('{"status":"OK","comment":"testcomment"}')
              .end((err, res) => {
                if (err) done(err);
                resolve();
              });
          });

          // 削除
          const promiseDeleted = Promise.all([promiseAvailability, promiseComment]).then(() => {
            return new Promise((resolve) => {
              request(app)
                .post(`/schedules/${scheduleId}?delete=1`)
                .end((err, res) => {
                  if (err) done(err);
                  resolve();
                });
            });
          });

          // コメント出欠候補予定がデータベース上から削除されている
          promiseDeleted.then(() => {
            const p1 = Comment.findAll({
              where: { schedule_id: scheduleId }
            }).then((comments) => {
              assert.equal(comments.length, 0);
            });
            const p2 = Availability.findAll({
              where: { schedule_id: scheduleId }
            }).then((availabilities) => {
              assert.equal(availabilities.length, 0);
            });
            const p3 = Candidate.findAll({
              where: { schedule_id: scheduleId }
            }).then((candidates) => {
              assert.equal(candidates.length, 0);
            });
            const p4 = Schedule.findByPk(scheduleId).then((schedule) => {
              assert.equal(!schedule, true);
            });
            Promise.all([p1, p2, p3, p4]).then(() => {
              if (err) return done(err);
              done();
            });
          });
        });
    });
  });
});