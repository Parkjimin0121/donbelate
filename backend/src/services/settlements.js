import { randomUUID } from "node:crypto";
import { httpError } from "../utils/errors.js";
import { minutesLate, nowIso } from "../utils/time.js";

export function settleMeeting(db, meeting) {
  if (!meeting.finalLateFeePerMinute) {
    throw httpError(409, "Late fee has not been finalized.");
  }

  const existingSettlement = db.settlements.find((item) => item.meetingId === meeting.id);
  if (existingSettlement) {
    meeting.status = "settled";
    return existingSettlement;
  }

  const roomMembers = db.roomMembers.filter((member) => member.roomId === meeting.roomId);
  const participantIds = new Set(getNormalizedParticipantUserIds(db, meeting));
  const participants = roomMembers.filter((member) => participantIds.has(member.userId));
  const checkins = db.checkins.filter((checkin) => checkin.meetingId === meeting.id);
  const checkinByUser = new Map(checkins.map((checkin) => [checkin.userId, checkin]));

  const arrivals = participants.map((participant) => {
    const checkin = checkinByUser.get(participant.userId);
    const arrivedAt = checkin?.arrivedAt ?? nowIso();
    return {
      userId: participant.userId,
      arrivedAt,
      lateMinutes: minutesLate(meeting.scheduledAt, arrivedAt)
    };
  });

  const totalLateFee = arrivals.reduce(
    (sum, arrival) => sum + arrival.lateMinutes * meeting.finalLateFeePerMinute,
    0
  );
  const latestArrival = arrivals.reduce(
    (latest, arrival) =>
      new Date(arrival.arrivedAt) > new Date(latest) ? arrival.arrivedAt : latest,
    meeting.scheduledAt
  );

  const rewards = arrivals.map((arrival) => {
    const waitStart =
      new Date(arrival.arrivedAt) > new Date(meeting.scheduledAt)
        ? arrival.arrivedAt
        : meeting.scheduledAt;
    const waitingMinutes = Math.max(
      0,
      Math.ceil((new Date(latestArrival).getTime() - new Date(waitStart).getTime()) / 60000)
    );

    return { ...arrival, waitingMinutes };
  });

  const totalWaitingMinutes = rewards.reduce((sum, reward) => sum + reward.waitingMinutes, 0);
  const distributions = rewards.map((reward) => ({
    userId: reward.userId,
    lateMinutes: reward.lateMinutes,
    waitingMinutes: reward.waitingMinutes,
    lateFee: reward.lateMinutes * meeting.finalLateFeePerMinute,
    reward:
      totalWaitingMinutes > 0
        ? Math.floor((totalLateFee * reward.waitingMinutes) / totalWaitingMinutes)
        : 0
  }));

  const settlement = {
    id: randomUUID(),
    meetingId: meeting.id,
    finalLateFeePerMinute: meeting.finalLateFeePerMinute,
    totalLateFee,
    totalWaitingMinutes,
    distributions,
    createdAt: nowIso()
  };

  for (const item of distributions) {
    if (item.lateFee > 0) {
      db.pointTransactions.push({
        id: randomUUID(),
        userId: item.userId,
        meetingId: meeting.id,
        type: "late_fee",
        amount: -item.lateFee,
        createdAt: nowIso()
      });
    }

    if (item.reward > 0) {
      db.pointTransactions.push({
        id: randomUUID(),
        userId: item.userId,
        meetingId: meeting.id,
        type: "waiting_reward",
        amount: item.reward,
        createdAt: nowIso()
      });
    }
  }

  db.settlements = db.settlements.filter((item) => item.meetingId !== meeting.id);
  db.settlements.push(settlement);
  meeting.status = "settled";
  return settlement;
}

function getNormalizedParticipantUserIds(db, meeting) {
  const roomMemberIds = db.roomMembers
    .filter((member) => member.roomId === meeting.roomId)
    .map((member) => member.userId);
  const roomMemberIdSet = new Set(roomMemberIds);

  const selectedIds = Array.isArray(meeting.participantUserIds)
    ? meeting.participantUserIds
        .map((userId) => String(userId))
        .filter((userId, index, ids) => roomMemberIdSet.has(userId) && ids.indexOf(userId) === index)
    : [];

  if (meeting.createdByUserId && roomMemberIdSet.has(meeting.createdByUserId)) {
    if (selectedIds.length === 0) return [meeting.createdByUserId];
    if (Number(meeting.capacity) === 1 && selectedIds.length > 1) return [meeting.createdByUserId];
  }

  if (Number(meeting.capacity) > 0 && selectedIds.length > Number(meeting.capacity)) {
    return selectedIds.slice(0, Number(meeting.capacity));
  }

  if (selectedIds.length > 0) return selectedIds;
  return roomMemberIds;
}
