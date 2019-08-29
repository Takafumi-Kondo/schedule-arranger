'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');//認証を確かめるハンドラ関数読み込み
const uuid = require('uuid');//被らないランダム ID
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');
const Availability = require('../models/availability');
const Comment = require('../models/comment');

router.get('/new', authenticationEnsurer, (req, res, next) => {
    res.render('new', {user: req.user});
});

router.post('/', authenticationEnsurer, (req, res, next) => {
  const scheduleId = uuid.v4();
  const updatedAt = new Date();
  Schedule.create({
    schedule_id: scheduleId,
    schedulename: req.body.schedulename.slice(0, 255),//STRING255文字以内の文字
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  }).then((schedule) => {            //trim()前後の空白を削除、split()文字列を任意の箇所で区切って分割、  空だったら空文字にnull防止
    createCandidatesAndRedirect(parseCandidateNames(req), scheduleId, res);
  });//編集と同じ処理なのでcreateCandidatesAndRedirect という関数で、候補の作成とリダイレクトを行うようにまとめた。
});

router.get('/:schedule_id', authenticationEnsurer, (req, res, next) => {
  let storedSchedule = null; //データベースに保存されている「予定」
  let storedCandidates = null;//データベースに保存されている「候補」
//上記のように then に渡す関数のスコープの外側に変数宣言をすることで、ほかの then に渡している関数からも利用できるようにしている
  Schedule.findOne({
    include: [{//テーブル結合 schedule.userにユーザー情報が設定されてる
      model: User,
      attributes: ['user_id', 'username']
    }],
    where: {
      schedule_id: req.params.schedule_id
    },
    order: [['"updatedAt"', 'DESC']]
  }).then((schedule) => {
    if(schedule) {
      storedSchedule = schedule;
      return Candidate.findAll({
        where: { schedule_id: schedule.schedule_id},
        order: [['"candidate_id"', 'ASC']]
      })
    } else {
      const err = new Error('指定された予定は見つかりません');
      err.status = 404;
      next(err);
    }
  }).then((candidates) => {
// 予定の全ての出欠を取得する
  storedCandidates = candidates;
    return Availability.findAll({
      include: [{model: User, attributes: ['user_id', 'username']}],
      where: {schedule_id: storedSchedule.schedule_id},
      order: [[User, '"username"', 'ASC'], ['"candidate_id"', 'ASC']]
    });
  }).then((availabilities) => {
// 出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) を作成する
    const availabilityMapMap = new Map();// key: user_id, value: Map(key: candidate_id, availability)
    availabilities.forEach((a) => {
      const map = availabilityMapMap.get(a.user.user_id) || new Map();
      map.set(a.candidate_id, a.availability);
      availabilityMapMap.set(a.user_id, map);
    });
// 閲覧ユーザーと出欠に紐づくユーザーからユーザーMap (キー:ユーザー ID, 値:ユーザー) を作る
    const userMap = new Map();// key: user_id, value: User
    userMap.set(parseInt(req.user.id), {
      isSelf: true,//本人
      user_id: parseInt(req.user.id),
      username: req.user.username
    });
    availabilities.forEach((a) => {
      userMap.set(a.user.user_id, {
        isSelf: parseInt(req.user.id) === a.user.user_id,// 閲覧ユーザー自身であるかを含める、そしてfalse
        user_id: a.user.user_id,
        username: a.user.username
      });
    });
// 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
      const users = Array.from(userMap).map((keyValue) => keyValue[1]);
      users.forEach((u) => {
        storedCandidates.forEach((c) => {
          const map = availabilityMapMap.get(u.user_id) || new Map();
          const a = map.get(c.candidate_id) || 0; //出欠データなければデフォルト値 0を利用
          map.set(c.candidate_id, a);
          availabilityMapMap.set(u.user_id, map);
        });
      });
// コメント取得
      return Comment.findAll({
        where: { schedule_id: storedSchedule.schedule_id }
      }).then((comments) => {
        const commentMap = new Map();// key: user_id, value: comment
        comments.forEach((comment) => {
          commentMap.set(comment.user_id, comment.comment);
        });
        res.render('schedule', {
          user: req.user,
          schedule: storedSchedule,
          candidates: storedCandidates,
          users: users,
          availabilityMapMap: availabilityMapMap,
          commentMap: commentMap
        });
      });
    });
  });

  router.get('/:schedule_id/edit', authenticationEnsurer, (req, res, next) => {
    Schedule.findOne({
      where: {
        schedule_id: req.params.schedule_id
      }
    }).then((schedule) => {
      if(isMine(req, schedule)) {// 作成者のみが編集フォームを開ける。isMine という関数を別途用意して、自身の予定であればその後の処理
        Candidate.findAll({//実装で候補を取得し、テンプレート edit を描画
          where: { schedule_id: schedule.schedule_id },
          order: [['"candidate_id"', 'ASC']]
        }).then((candidates) => {
          res.render('edit', {
            user: req.user,
            schedule: schedule,
            candidates: candidates
          });
        });
      } else {//予定が自分が作ったものでなかったり、そもそも存在しなかったときに使われる
        const err = new Error('指定された予定がない、または、予定する権限がありません。');
        err.status = 404;
        next(err);
      }
    });
  });

  function isMine(req, schedule) {//リクエストと予定のオブジェクトを受け取り、その予定が自分のものであるかの真偽値を返す
    return schedule && parseInt(schedule.createdBy) === parseInt(req.user.id);
  }

  router.post('/:schedule_id', authenticationEnsurer, (req, res, next) => {
    if (parseInt(req.query.edit) === 1) {
      Schedule.findOne({//edit=1 のクエリがあるときのみ
        where: { schedule_id: req.params.schedule_id }
    }).then((schedule) => {
      if(isMine(req, schedule)) {//リクエストの送信者が作成者であるかをチェックし
        const updatedAt = new Date();
        schedule.update({
          schedule_id: schedule.schedule_id,
          schedulename: req.body.schedulename.slice(0, 255),
          memo: req.body.memo,
          createdBy: req.user.id,
          updatedAt: updatedAt
        }).then((schedule) => {
          Candidate.findAll({
            where: { schedule_id: schedule.schedule_id},
            order: [['"candidate_id"', 'ASC']]
          }).then((candidates) => {
            // 追加されているかチェック
            const candidateNames = parseCandidateNames(req);//リクエストから候補日程の配列をパースする関数 parseCandidateNames を呼び出します
            if(candidateNames) {
              createCandidatesAndRedirect(candidateNames, schedule.schedule_id, res);
            } else {
              res.redirect('/schedules/' + schedule.schedule_id);
            }
          });
        });
      } else {//edit=1 以外のクエリが渡された際に 400 Bad Request のステータスコードを返す
        const err = new Error('指定された予定がない、または、編集する権限がありません');
        err.status = 404;
        next(err);
      }
    });
  } else if (parseInt(req.query.delete) === 1) {
    deleteScheduleAggregate(req.params.schedule_id, () => {
      res.redirect('/');
    });
  } else {//予定が見つからない場合や自分自身の予定ではない場合に、 404 Not Found のステータスコード
    const err = new Error('不正なリクエストです');
    err.status = 400;
    next(err);
  }
});

// Aggregate:集約, deleteScheduleAggregate特定の親のデータモデルが他のデータモデルを所有
// test/test.js の deleteScheduleAggregate をほとんど使用
function deleteScheduleAggregate(scheduleId, done, err) {
  const promiseCommentDestroy = Comment.findAll({//ここでコメントが削除された Promise オブジェクトを作成
    where: { schedule_id: scheduleId }
  }).then((comments) => {//comments.map((c) => { return c.destroy(); });});
    return Promise.all(comments.map((c) => { return c.destroy(); }));
  });
//Promiseのthen関数をうまく利用するために書き換え上下
  Availability.findAll({//出欠全て取得からの削除
    where: { schedule_id: scheduleId }
  }).then((availabilities) => {
    const promises = availabilities.map((a) => { return a.destroy(); });//子から消していくことでデータベースの処理不都合を防止する
    return Promise.all(promises);
  }).then(() => {
    return Candidate.findAll({//全ての候補が取得できたことの Promise オブジェクトを返し
      where: { schedule_id: scheduleId }
    });
  }).then((candidates) => {//ここで、全ての候補が削除され、かつ、全てのコメントが削除されたことを示す Promise オブジェクトを作成して return 句で返
    const promises = candidates.map((c) => { return c.destroy(); });
    promises.push(promiseCommentDestroy);
    return Promise.all(promises);
  }).then(() => {//最後の done 関数の実行の部分だけ、予定が削除されたことを受け取った Promise オブジェクトの then 関数にて done 関数を呼ぶように変更
    return Schedule.findByPk(scheduleId).then((s) => { s.destroy(); });
  }).then(() => {
    if(err) return done(err);
    done();
  });
}
//test/test.js 内でもこの関数を利用できるように
router.deleteScheduleAggregate = deleteScheduleAggregate;

function createCandidatesAndRedirect(candidateNames, scheduleId, res) {//すでに予定作成にあった実装の切り出しを行った関数
  const candidates = candidateNames.map((c) => {
    return {
      candidateName: c,
      schedule_id: scheduleId
    };
  });
  Candidate.bulkCreate(candidates).then(() => {
    res.redirect('/schedules/' + scheduleId);
  });
}

function parseCandidateNames(req) {
  return req.body.candidates.trim().split('\n').map((s) => s.trim()).filter((s) => s !== "");
}
/*すでに存在したリクエストから予定名の配列をパースする処理を、 parseCandidateNames という関数名で切り出したもの
 * 関数は切り出すことによって、他の場所で再利用することができるので
 */

module.exports = router;