'use strict';
import $ from 'jquery';

$('.availability-toggle-button').each((i, e) => {//クラスavailability-toggle-button要素取得
  const button = $(e);//$(e) で、 ボタン要素の jQuery オブジェクトを取得
  button.click(() => {
    const scheduleId = button.data('schedule-id');//ここからjQuery の data 関数を使用して data-* 属性を取得することで、各ID取得している
    const userId = button.data('user-id');
    const candidateId = button.data('candidate-id');
    const availability = parseInt(button.data('availability'));//数値の計算をしたいため、 parseInt 関数を利用
    const nextAvailability = (availability + 1) % 3;// 0 → 1 → 2 → 0...と循環させるため+1した3の剰余利用(出欠数値)
    $.post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidateId}`,
      { availability: nextAvailability },
      (data) => {
        button.data('availability', data.availability);
        const availabilityLabels = ['欠', '?', '出'];
        button.text(availabilityLabels[data.availability]);
      });
  });//post〜は、出欠更新の Web API の呼び出しと、実行結果を受け取って button 要素の、 data-* 属性を更新し、ボタンのラベルを更新
});

const buttonSelfComment = $('#self-comment-button');
buttonSelfComment.click(() => {
  const scheduleId = buttonSelfComment.data('schedule-id');
  const userId = buttonSelfComment.data('user-id');
  const comment = prompt('コメントを255文字以内で入力してください。');//prompt 入力ダイアログを表示させる
  if(comment) {
    $.post(`/schedules/${scheduleId}/users/${userId}/comments`,
      { comment: comment },
      (data) => {
        $('#self-comment').text(data.comment);
      });
  }
});