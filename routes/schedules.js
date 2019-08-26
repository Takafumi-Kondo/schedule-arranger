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
    const candidateNames = req.body.candidates.trim().split('\n').map((s) => s.trim()).filter((s) => s !== "");
    const candidates = candidateNames.map((c) => { return {//mapの使い方
      candidateName: c,
      schedule_id: schedule.schedule_id
    };});
    Candidate.bulkCreate(candidates).then(() => {//配列を区切るとbulkCreateで複数登録できる
      res.redirect('/schedules/' + schedule.schedule_id);
    });
  });
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

module.exports = router;