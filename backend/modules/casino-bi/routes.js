'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const controller = require('./controller');

router.get('/casino/kpi', requireAuth, controller.getLatestKpis);
router.post('/casino/kpi/refresh', requireAuth, controller.refresh);
router.get('/casino/kpi/status', requireAuth, controller.status);

module.exports = router;
