'use strict';

function ensure(req, res, next) {
  if(req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}
//この認証をチェックして、認証されていない場合は /login にリダイレクトを行う関数をモジュールとして用意

module.exports = ensure;