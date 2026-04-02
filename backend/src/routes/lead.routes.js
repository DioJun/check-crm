const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const spreadsheetController = require('../controllers/spreadsheet.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Rotas de upload de planilha
router.post('/upload', spreadsheetController.upload, spreadsheetController.parseSpreadsheet);
router.post('/import-spreadsheet', spreadsheetController.importFromSpreadsheet);
router.post('/import-google-maps', spreadsheetController.importGoogleMapsLeads);
router.post('/check-duplicates', spreadsheetController.checkDuplicates);

router.get('/stats', leadController.getStats);
router.get('/', leadController.getAll);
router.get('/:id', leadController.getById);
router.post('/', leadController.create);
router.post('/import', leadController.importLeads);
router.put('/:id', leadController.update);
router.delete('/:id', leadController.delete);
router.delete('/', leadController.deleteMultiple);

module.exports = router;
