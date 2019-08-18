'use strict';
const loader = require('./sequelize-loader');
const Sequelize = loader.Sequelize;

const Comment = loader.database.define('comments', {
    schedule_id: {
      type: Sequelize.UUID,
      primaryKey: true,//
      allowNull: false
    },
    user_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,//複合主キー
      allowNull: false
    },
    comment: {
      type: Sequelize.STRING,
      allowNull: false
    }
  }, {
    freezeTableName: true,
    timestamps: false
});
/*複合主キーは上から順に作成される
主キーには自動的にインデックスが構築される
*/
module.exports = Comment;