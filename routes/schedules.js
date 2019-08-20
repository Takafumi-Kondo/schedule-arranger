'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');//認証を確かめるハンドラ関数読み込み
const uuid = require('uuid');//被らないランダム ID
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');

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
  Schedule.findOne({
    include: [{
      model: User,
      attributes: ['user_id', 'username']
    }],
    where: {
      schedule_id: req.params.schedule_id
    },
    order: [['"updatedAt"', 'DESC']]
  }).then((schedule) => {
    if(schedule) {
      Candidate.findAll({
        where: { schedule_id: schedule.schedule_id},
        order: [['"candidate_id"', 'ASC']]
      }).then((candidates) => {
        res.render('schedule', {
          user: req.user,
          schedule: schedule,
          candidates: candidates,
          users: [req.user]
        });
      });
    } else {
      const err = new Error('指定された予定は見つかりません');
      error.status = 404;
      next(err);
    }
  });
});

module.exports = router;