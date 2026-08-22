const { validationResult } = require('express-validator');
const appointmentService = require('../services/appointmentService');
const prisma = require('../config/db');

async function book(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user.userId } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const { doctorId, scheduledAt, symptoms } = req.body;
    const appointment = await appointmentService.bookAppointment({
      patientId: patient.id,
      doctorId,
      scheduledAt,
      symptoms,
    });

    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const appointments = await appointmentService.getAppointments(
      req.user.userId,
      req.user.role
    );
    res.json(appointments);
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const appointment = await appointmentService.getAppointment(
      req.params.appointmentId,
      req.user.userId,
      req.user.role
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const appointment = await appointmentService.cancelAppointment(
      req.params.appointmentId,
      req.user.userId,
      req.user.role
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

async function reschedule(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const appointment = await appointmentService.rescheduleAppointment(
      req.params.appointmentId,
      req.body.scheduledAt,
      req.user.userId,
      req.user.role
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

async function submitSymptoms(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await appointmentService.submitSymptoms(
      req.params.appointmentId,
      req.body.symptoms,
      req.user.userId,
      req.user.role
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function submitPostVisitNotes(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await appointmentService.submitPostVisitNotes(
      req.params.appointmentId,
      req.body,
      req.user.userId,
      req.user.role
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { book, list, get, cancel, reschedule, submitSymptoms, submitPostVisitNotes };
