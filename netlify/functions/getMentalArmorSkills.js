// netlify/functions/getMentalArmorSkills.js
const { google } = require('googleapis');
const { corsHeaders, methodGuard, ok } = require('./_utils/http');
const { loadServiceAccount } = require('./_utils/google');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Cache for skills data
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin);
  const guard = methodGuard(event, headers, 'GET', 'OPTIONS');
  if (guard) return guard;

  try {
    // Check cache first
    const nowMs = Date.now();
    if (cache && (nowMs - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[MentalArmorSkills] Returning cached data');
      return ok(headers, { ...cache, cached: true });
    }

    if (!SHEET_ID) {
      return ok(headers, { success: false, error: 'GOOGLE_SHEET_ID not configured' });
    }

    console.log('[MentalArmorSkills] Fetching skills from Google Sheet...');

    const credentials = loadServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // First, let's check what tabs are available
    try {
      const sheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
      });
      
      const sheetNames = sheetInfo.data.sheets?.map(sheet => sheet.properties?.title) || [];
      console.log('[MentalArmorSkills] Available tabs:', sheetNames);
      
      if (!sheetNames.includes('MentalArmorSkills')) {
        console.log('[MentalArmorSkills] MentalArmorSkills tab not found. Available tabs:', sheetNames);
        return ok(headers, { 
          success: false, 
          error: 'MentalArmorSkills tab not found',
          availableTabs: sheetNames,
          message: `Please create a tab named "MentalArmorSkills" with headers: SkillTitle, Benefits, When, How, Researcher, ResearchBullet, Goal`
        });
      }
    } catch (err) {
      console.error('[MentalArmorSkills] Error checking sheet info:', err.message);
    }

    // Fetch skills from MentalArmorSkills tab
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'MentalArmorSkills!A:G', // SkillTitle, Benefits, When, How, Researcher, ResearchBullet, Goal
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      console.log('[MentalArmorSkills] No skills data found in sheet');
      return ok(headers, { 
        success: true, 
        skills: [],
        count: 0,
        message: 'No skills data found in MentalArmorSkills tab'
      });
    }

    // Skip header row, map to skills objects
    const skills = rows.slice(1).map((row, index) => {
      const [skillTitle, benefits, when, how, researcher, researchBullet, goal] = row;
      
      return {
        id: index + 1,
        skillTitle: skillTitle || '',
        benefits: benefits || '',
        when: when || '',
        how: how || '',
        researcher: researcher || '',
        researchBullet: researchBullet || '',
        goal: goal || ''
      };
    }).filter(skill => skill.skillTitle); // Only include skills with titles

    const responseData = {
      success: true,
      skills,
      count: skills.length,
      lastUpdated: new Date().toISOString()
    };

    // Cache the response
    cache = responseData;
    cacheTimestamp = nowMs;
    console.log('[MentalArmorSkills] Data cached for 30 minutes. Found', skills.length, 'skills.');

    return ok(headers, responseData);

  } catch (err) {
    console.error('[MentalArmorSkills] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: err.message,
        details: 'Failed to fetch Mental Armor skills from Google Sheet'
      })
    };
  }
};
