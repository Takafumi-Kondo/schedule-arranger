'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

const Candidate = loader.database.define('candidates', {
  candidate_id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  candidateName: {
    type: Sequelize.STRING,
    allowNull: false
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

module.exports = Candidate;