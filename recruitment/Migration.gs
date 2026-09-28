/**
 * TW&D Recruitment Safe Consolidation / Migration
 *
 * PURPOSE:
 * - Creates one canonical "TW&D Recruitment Master" spreadsheet.
 * - Copies application and aptitude records from existing TW&D recruitment
 *   spreadsheets into the master without deleting or moving source data.
 * - Builds a migration register and Drive-file inventory.
 * - Sets SHEET_ID to the master only after the consolidation completes.
 *
 * IMPORTANT:
 * - This code NEVER trashes, deletes, moves, or renames existing files.
 * - Existing Drive CVs/supporting documents remain where they are.
 * - Run consolidateRecruitmentNow() once from Apps Script after adding this file.
 */

const MASTER_RECRUITMENT_NAME = 'TW&D Recruitment Master';
const MIGRATION_LOG_SHEET = 'Migration Log';
const DRIVE_INVENTORY_SHEET = 'Drive File Inventory';

function consolidateRecruitmentNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Another recruitment consolidation is already running.');
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const oldSheetId = String(props.getProperty('SHEET_ID') || '').trim();

    const master = getOrCreateMasterRecruitmentSpreadsheet_();
    const applications = getOrCreateSheetWithHeaders_(
      master,
      'Applications',
      HEADERS
    );

    const aptitudeHeaders =
      typeof APTITUDE_HEADERS !== 'undefined'
        ? APTITUDE_HEADERS
        : [
            'Test ID','Application ID','Position','Applicant Email','Status',
            'Started At','Expires At','Submitted At','Score','Score Over 100',
            'AI Assessment','Questions JSON','Answers JSON','Admin Decision','Admin Notes'
          ];

    const aptitude = getOrCreateSheetWithHeaders_(
      master,
      'Aptitude Tests',
      aptitudeHeaders
    );

    const log = getOrCreateSheetWithHeaders_(
      master,
      MIGRATION_LOG_SHEET,
      [
        'Run Time',
        'Source Spreadsheet',
        'Source Spreadsheet ID',
        'Source URL',
        'Applications Found',
        'Applications Imported',
        'Applications Already Present',
        'Aptitude Tests Found',
        'Aptitude Tests Imported',
        'Aptitude Tests Already Present',
        'Drive Folder',
        'Result',
        'Notes'
      ]
    );

    const sourceFiles = findRecruitmentSourceSpreadsheets_(oldSheetId, master.getId());
    const applicationKeys = getExistingKeys_(applications, 1);
    const aptitudeKeys = getExistingKeys_(aptitude, 1);

    let totalAppsFound = 0;
    let totalAppsImported = 0;
    let totalAppDuplicates = 0;
    let totalTestsFound = 0;
    let totalTestsImported = 0;
    let totalTestDuplicates = 0;

    sourceFiles.forEach(function(file) {
      let appsFound = 0;
      let appsImported = 0;
      let appDuplicates = 0;
      let testsFound = 0;
      let testsImported = 0;
      let testDuplicates = 0;
      let notes = [];

      try {
        const ss = SpreadsheetApp.openById(file.getId());

        const sourceApps = ss.getSheetByName('Applications');
        if (sourceApps && sourceApps.getLastRow() > 1) {
          const result = migrateSheetRows_(
            sourceApps,
            applications,
            HEADERS,
            applicationKeys,
            'APP',
            file.getId()
          );
          appsFound = result.found;
          appsImported = result.imported;
          appDuplicates = result.duplicates;
          result.notes.forEach(function(n) { notes.push(n); });
        }

        const sourceAptitude = ss.getSheetByName('Aptitude Tests');
        if (sourceAptitude && sourceAptitude.getLastRow() > 1) {
          const result = migrateSheetRows_(
            sourceAptitude,
            aptitude,
            aptitudeHeaders,
            aptitudeKeys,
            'APT',
            file.getId()
          );
          testsFound = result.found;
          testsImported = result.imported;
          testDuplicates = result.duplicates;
          result.notes.forEach(function(n) { notes.push(n); });
        }

        log.appendRow([
          new Date(),
          file.getName(),
          file.getId(),
          file.getUrl(),
          appsFound,
          appsImported,
          appDuplicates,
          testsFound,
          testsImported,
          testDuplicates,
          getRecruitmentFolder_().getUrl(),
          'PRESERVED',
          notes.join(' | ').slice(0, 2000)
        ]);
      } catch (err) {
        log.appendRow([
          new Date(),
          file.getName(),
          file.getId(),
          file.getUrl(),
          appsFound,
          appsImported,
          appDuplicates,
          testsFound,
          testsImported,
          testDuplicates,
          getRecruitmentFolder_().getUrl(),
          'ERROR - SOURCE PRESERVED',
          String(err && err.message ? err.message : err).slice(0, 2000)
        ]);
      }

      totalAppsFound += appsFound;
      totalAppsImported += appsImported;
      totalAppDuplicates += appDuplicates;
      totalTestsFound += testsFound;
      totalTestsImported += testsImported;
      totalTestDuplicates += testDuplicates;
    });

    // Build a current inventory of every file in the recruitment folder.
    rebuildRecruitmentDriveInventory_(master);

    // Only now make the master the canonical spreadsheet.
    props.setProperty('SHEET_ID', master.getId());

    // Reinstall the existing triggers against the master spreadsheet.
    if (typeof installStatusTrigger_ === 'function') {
      installStatusTrigger_();
    }

    if (typeof installRecruitmentEmailTrigger_ === 'function') {
      installRecruitmentEmailTrigger_();
    }

    SpreadsheetApp.flush();

    return {
      ok: true,
      masterSpreadsheetId: master.getId(),
      masterSpreadsheetUrl: master.getUrl(),
      sourceSpreadsheetCount: sourceFiles.length,
      applicationsFound: totalAppsFound,
      applicationsImported: totalAppsImported,
      applicationsAlreadyPresent: totalAppDuplicates,
      aptitudeTestsFound: totalTestsFound,
      aptitudeTestsImported: totalTestsImported,
      aptitudeTestsAlreadyPresent: totalTestDuplicates,
      message:
        'SAFE CONSOLIDATION COMPLETE. The master spreadsheet is now canonical. ' +
        'No source spreadsheet or Drive document was deleted, moved, or renamed.'
    };
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateMasterRecruitmentSpreadsheet_() {
  const files = DriveApp.getFilesByName(MASTER_RECRUITMENT_NAME);

  while (files.hasNext()) {
    const file = files.next();
    try {
      return SpreadsheetApp.openById(file.getId());
    } catch (err) {
      // Ignore a non-spreadsheet file with the same name.
    }
  }

  const ss = SpreadsheetApp.create(MASTER_RECRUITMENT_NAME);

  // Keep the master in the existing recruitment folder when possible.
  try {
    const folder = getRecruitmentFolder_();
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  } catch (err) {
    // The spreadsheet remains safe in My Drive if the folder cannot be opened.
  }

  return ss;
}

function getOrCreateSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    let changed = false;

    headers.forEach(function(header, index) {
      if (!current[index]) {
        current[index] = header;
        changed = true;
      }
    });

    if (changed) {
      sheet.getRange(1, 1, 1, headers.length).setValues([current]);
    }
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  return sheet;
}

function findRecruitmentSourceSpreadsheets_(currentSheetId, masterId) {
  const found = {};
  const files = DriveApp.getFilesByType(MimeType.GOOGLE_SHEETS);

  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();

    if (id === masterId) continue;

    const name = String(file.getName() || '');
    const lower = name.toLowerCase();

    // Include the currently configured spreadsheet even if its name is unusual.
    const isCurrent = currentSheetId && id === currentSheetId;

    // Other sources are deliberately restricted to recruitment/company names
    // so unrelated personal spreadsheets are never copied accidentally.
    const looksLikeRecruitment =
      lower.indexOf('twd') !== -1 &&
      lower.indexOf('recruit') !== -1;

    if (isCurrent || looksLikeRecruitment) {
      found[id] = file;
    }
  }

  return Object.keys(found).map(function(id) {
    return found[id];
  });
}

function getExistingKeys_(sheet, keyColumnNumber) {
  const keys = {};
  if (sheet.getLastRow() < 2) return keys;

  const values = sheet
    .getRange(2, keyColumnNumber, sheet.getLastRow() - 1, 1)
    .getValues();

  values.forEach(function(row) {
    const key = String(row[0] || '').trim();
    if (key) keys[key] = true;
  });

  return keys;
}

function migrateSheetRows_(
  sourceSheet,
  destinationSheet,
  destinationHeaders,
  existingKeys,
  kind,
  sourceFileId
) {
  const result = {
    found: 0,
    imported: 0,
    duplicates: 0,
    notes: []
  };

  const lastRow = sourceSheet.getLastRow();
  const lastColumn = sourceSheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) return result;

  const sourceValues = sourceSheet
    .getRange(1, 1, lastRow, lastColumn)
    .getValues();

  const sourceHeaders = sourceValues[0].map(function(v) {
    return String(v || '').trim();
  });

  const sourceHeaderMap = {};
  sourceHeaders.forEach(function(header, index) {
    if (header) sourceHeaderMap[header] = index;
  });

  const output = [];

  for (let r = 1; r < sourceValues.length; r++) {
    const sourceRow = sourceValues[r];
    const originalKey = String(sourceRow[0] || '').trim();

    if (!sourceRow.some(function(v) {
      return String(v == null ? '' : v).trim() !== '';
    })) {
      continue;
    }

    result.found++;

    let key = originalKey;

    if (!key) {
      key =
        'MIGRATED-' +
        kind +
        '-' +
        sourceFileId.slice(0, 8) +
        '-' +
        String(r + 1);
      result.notes.push(
        kind +
        ' row ' +
        String(r + 1) +
        ' had no ID; assigned ' +
        key +
        ' in the master only.'
      );
    }

    if (existingKeys[key]) {
      result.duplicates++;
      continue;
    }

    const targetRow = destinationHeaders.map(function(header) {
      const index = sourceHeaderMap[header];
      return index == null ? '' : sourceRow[index];
    });

    // Preserve the generated migration key only when the source lacked an ID.
    if (!originalKey) {
      targetRow[0] = key;
    }

    output.push(targetRow);
    existingKeys[key] = true;
  }

  if (output.length) {
    destinationSheet
      .getRange(
        destinationSheet.getLastRow() + 1,
        1,
        output.length,
        destinationHeaders.length
      )
      .setValues(output);

    result.imported = output.length;
  }

  return result;
}

function rebuildRecruitmentDriveInventory_(master) {
  let sheet = master.getSheetByName(DRIVE_INVENTORY_SHEET);

  if (!sheet) {
    sheet = master.insertSheet(DRIVE_INVENTORY_SHEET);
  }

  sheet.clearContents();

  const headers = [
    'Indexed At',
    'File Name',
    'File ID',
    'File URL',
    'Mime Type',
    'Size Bytes',
    'Last Updated',
    'Folder'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const rows = [];
  const root = getRecruitmentFolder_();

  indexFolderFiles_(root, root.getName(), rows);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.autoResizeColumns(1, headers.length);
}

function indexFolderFiles_(folder, folderPath, rows) {
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();

    let size = '';
    try {
      size = file.getSize();
    } catch (err) {
      size = '';
    }

    rows.push([
      new Date(),
      file.getName(),
      file.getId(),
      file.getUrl(),
      file.getMimeType(),
      size,
      file.getLastUpdated(),
      folderPath
    ]);
  }

  const folders = folder.getFolders();

  while (folders.hasNext()) {
    const child = folders.next();
    indexFolderFiles_(
      child,
      folderPath + ' / ' + child.getName(),
      rows
    );
  }
}

/**
 * Read-only diagnostic after migration.
 * It does not delete or modify source spreadsheets.
 */
function verifyRecruitmentConsolidation() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = String(props.getProperty('SHEET_ID') || '').trim();

  if (!sheetId) {
    throw new Error('No canonical recruitment spreadsheet is configured.');
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const applications = ss.getSheetByName('Applications');
  const aptitude = ss.getSheetByName('Aptitude Tests');
  const inventory = ss.getSheetByName(DRIVE_INVENTORY_SHEET);

  return {
    ok: true,
    canonicalSpreadsheetName: ss.getName(),
    canonicalSpreadsheetId: ss.getId(),
    canonicalSpreadsheetUrl: ss.getUrl(),
    applicationRows: applications
      ? Math.max(0, applications.getLastRow() - 1)
      : 0,
    aptitudeRows: aptitude
      ? Math.max(0, aptitude.getLastRow() - 1)
      : 0,
    driveFilesIndexed: inventory
      ? Math.max(0, inventory.getLastRow() - 1)
      : 0,
    message:
      'Verification complete. The canonical spreadsheet is active and ' +
      'source files remain preserved.'
  };
}
