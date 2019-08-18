const request = require('supertest');//Router オブジェクトをテストするモジュール
const app = require('../app');
// モジュール単体テストをするmochaというテスティングフレームワーク使用
const passportStub = require('passport-stub');//ログインした時には /login にユーザー名が表示されることをテスト


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