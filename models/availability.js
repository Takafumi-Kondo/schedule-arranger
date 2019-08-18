'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

const Availability = loader.database.define('availabilities', {
  candidate_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,//
    allowNull: false
  },
  user_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,//複合主キー
    allowNull: false
  },
  availability: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  schedule_id: {
    type: Sequelize.UUID,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: false,
  indexes: [
    {
      fields: ['schedule_id']
    }
  ]
});

module.exports = Availability;