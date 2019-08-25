'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const Availability = require('../models/availability');

router.post('/:schedule_id/users/:user_id/candidates/:candidate_id', authenticationEnsurer, (req, res, next) => {
  const scheduleId = req.params.schedule_id;
  const userId = req.params.user_id;
  const candidateId = req.params.candidate_id;
  let availability = req.body.availability;
  availability = availability ? parseInt(availability) : 0;

  Availability.upsert({
    schedule_id: scheduleId,
    user_id: userId,
    candidate_id: candidateId,
    availability: availability
  }).then(() => {
    res.json({ status: 'OK', availability: availability });
  });
});

module.exports = router;