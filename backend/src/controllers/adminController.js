const { validationResult } = require('express-validator');
const adminService = require('../services/adminService');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

async function createDoctor(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const doctor = await adminService.createDoctor(req.body);
    res.status(201).json(doctor);
  } catch (err) {
    next(err);
  }
}

async function getDoctors(req, res, next) {
  try {
    const doctors = await adminService.getDoctors();
    res.json(doctors);
  } catch (err) {
    next(err);
  }
}

async function getDoctor(req, res, next) {
  try {
    const doctor = await adminService.getDoctor(req.params.doctorId);
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

async function updateDoctor(req, res, next) {
  try {
    const doctor = await adminService.updateDoctor(req.params.doctorId, req.body);
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

async function deleteDoctor(req, res, next) {
  try {
    await adminService.deleteDoctor(req.params.doctorId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function addLeave(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const result = await adminService.addLeave(
      req.params.doctorId,
      req.body.date,
      req.body.reason
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function removeLeave(req, res, next) {
  try {
    await adminService.removeLeave(req.params.doctorId, req.params.date);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function getLeaves(req, res, next) {
  try {
    const leaves = await adminService.getLeaves(req.params.doctorId);
    res.json(leaves);
  } catch (err) {
    next(err);
  }
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
