'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const Comment = require('../models/comment');

router.post('/:schedule_id/users/:user_id/comments', authenticationEnsurer, (req, res, next) => {
  const scheduleId = req.params.schedule_id;
  const userId = req.params.user_id;
  const comment =  req.body.comment;

  Comment.upsert({
    schedule_id: scheduleId,
    user_id: userId,
    comment: comment.slice(0, 255)
  }).then(() => {
    res.json({ status: 'OK', comment: comment });
  });
});

module.exports = router;