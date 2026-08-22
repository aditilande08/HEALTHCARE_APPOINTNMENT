const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

async function createDoctor({ name, email, password, specialisation, bio, slotDuration, workingHours }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email already in use');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'DOCTOR',
      doctor: {
        create: {
          specialisation,
          bio: bio || null,
          slotDuration: slotDuration || 30,
          workingHours: workingHours || {},
        },
      },
    },
    include: { doctor: true },
  });

  const { passwordHash: _, ...safe } = user;
  return safe;
}

async function getDoctors() {
  const doctors = await prisma.doctor.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      leaves: { orderBy: { date: 'asc' } },
    },
    orderBy: { user: { name: 'asc' } },
  });
  return doctors;
}

async function getDoctor(doctorId) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      leaves: { orderBy: { date: 'asc' } },
    },
  });

  if (!doctor) {
    const err = new Error('Doctor not found');
    err.status = 404;
    throw err;
  }

  return doctor;
}

async function updateDoctor(doctorId, { name, phone, specialisation, bio, slotDuration, workingHours }) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    const err = new Error('Doctor not found');
    err.status = 404;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    if (name || phone) {
      await tx.user.update({
        where: { id: doctor.userId },
        data: { ...(name && { name }), ...(phone && { phone }) },
      });
    }

    const updated = await tx.doctor.update({
      where: { id: doctorId },
      data: {
        ...(specialisation && { specialisation }),
        ...(bio !== undefined && { bio }),
        ...(slotDuration && { slotDuration }),
        ...(workingHours && { workingHours }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    return updated;
  });

  return result;
}

async function deleteDoctor(doctorId) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    const err = new Error('Doctor not found');
    err.status = 404;
    throw err;
  }

  // cascades to Doctor, leaves, appointments via schema onDelete
  await prisma.user.delete({ where: { id: doctor.userId } });
}

async function addLeave(doctorId, date, reason) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) {
    const err = new Error('Doctor not found');
    err.status = 404;
    throw err;
  }

  const leaveDate = new Date(date);
  leaveDate.setUTCHours(0, 0, 0, 0);

  // wrap everything in a transaction — if notification logging fails we
  // don't want appointments cancelled without a record of it
  const result = await prisma.$transaction(async (tx) => {
    const leave = await tx.doctorLeave.create({
      data: { doctorId, date: leaveDate, reason: reason || null },
    });

    // find appointments on this date that are still active
    const dayStart = new Date(leaveDate);
    const dayEnd = new Date(leaveDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const affected = await tx.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        patient: { include: { user: true } },
      },
    });

    if (affected.length > 0) {
      const ids = affected.map((a) => a.id);

      await tx.appointment.updateMany({
        where: { id: { in: ids } },
        data: { status: 'CANCELLED' },
      });

      // log cancellation notifications for email service to pick up
      await tx.notificationLog.createMany({
        data: ids.map((id) => ({
          appointmentId: id,
          type: 'CANCELLATION',
          channel: 'EMAIL',
          status: 'PENDING',
        })),
      });
    }

    return { leave, affectedCount: affected.length };
  });

  return result;
}

async function removeLeave(doctorId, date) {
  const leaveDate = new Date(date);
  leaveDate.setUTCHours(0, 0, 0, 0);

  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId, date: leaveDate } },
  });

  if (!leave) {
    const err = new Error('Leave record not found');
    err.status = 404;
    throw err;
  }

  await prisma.doctorLeave.delete({
    where: { doctorId_date: { doctorId, date: leaveDate } },
  });
}

async function getLeaves(doctorId) {
  return prisma.doctorLeave.findMany({
    where: { doctorId },
    orderBy: { date: 'asc' },
  });
}

module.exports = {
  createDoctor,
  getDoctors,
  getDoctor,
  updateDoctor,
  deleteDoctor,
  addLeave,
  removeLeave,
  getLeaves,
};
