/**
 * POST /api/chef-podcast
 *
 * Submits Chef Podcast registrations into the
 * existing Google Form backend.
 *
 * This route keeps the branded frontend independent
 * from Google Forms while still preserving the team's
 * current Google Form / Google Sheet response workflow.
 */

import { NextResponse } from 'next/server';

const FORM_VIEW_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeAFBk6E-4HAK3a8Q6EhYFYtpqmoZdtHdiJIg7VGddovDIyqA/viewform?usp=header';

const FORM_RESPONSE_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeAFBk6E-4HAK3a8Q6EhYFYtpqmoZdtHdiJIg7VGddovDIyqA/formResponse';

const PAGE_HISTORY = '0,1,2,3,4,5,6';

const FIELD_MAP = {
  fullName: 'entry.1883460570',
  mobile: 'entry.633687695',
  email: 'entry.1507298541',
  city: 'entry.595041890',
  role: 'entry.1757567893',
  company: 'entry.137354594',
  experience: 'entry.672550243',
  cuisine: 'entry.1065073397',
  podcastInterest: 'entry.520236308',
  topics: 'entry.677622808',
  achievement: 'entry.1274931007',
  instagram: 'entry.1947627503',
  portfolio: 'entry.2095500058',
  videoConsent: 'entry.1339344912',
  followUpTime: 'entry.1875542037',
  recordingAvailability: 'entry.1664340553',
  consent: 'entry.1082564949',
};

const REQUIRED_FIELDS = [
  'fullName',
  'mobile',
  'email',
  'city',
  'role',
  'experience',
  'cuisine',
  'podcastInterest',
  'topics',
  'videoConsent',
  'consent',
];

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function getGoogleFormHiddenFields() {
  const response = await fetch(FORM_VIEW_URL, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Unable to read Google Form metadata: ${response.status}`);
  }

  const html = await response.text();
  const hiddenFields = {};
  const inputPattern = /<input\b[^>]*type="hidden"[^>]*>/gi;
  const namePattern = /\bname="([^"]+)"/i;
  const valuePattern = /\bvalue="([^"]*)"/i;

  for (const match of html.matchAll(inputPattern)) {
    const input = match[0];
    const name = input.match(namePattern)?.[1];
    const value = input.match(valuePattern)?.[1] || '';

    if (name) hiddenFields[name] = decodeHtmlAttribute(value);
  }

  return hiddenFields;
}

function getRequiredFieldErrors(payload) {
  return REQUIRED_FIELDS.filter((field) => {
    if (field === 'consent') return payload[field] !== true;
    return !String(payload[field] || '').trim();
  });
}

function appendIfPresent(params, key, value) {
  const normalizedValue = String(value || '').trim();
  if (normalizedValue) params.append(key, normalizedValue);
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const missingFields = getRequiredFieldErrors(payload);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please complete all required fields.',
          missingFields,
        },
        { status: 400 }
      );
    }

    const googleHiddenFields = await getGoogleFormHiddenFields();
    const params = new URLSearchParams();

    params.append('fvv', googleHiddenFields.fvv || '1');
    params.append('pageHistory', PAGE_HISTORY);
    params.append('submissionTimestamp', '-1');

    if (googleHiddenFields.partialResponse) {
      params.append('partialResponse', googleHiddenFields.partialResponse);
    }

    if (googleHiddenFields.fbzx) {
      params.append('fbzx', googleHiddenFields.fbzx);
    }

    for (const [field, entryId] of Object.entries(FIELD_MAP)) {
      if (field === 'consent') {
        if (payload.consent === true) params.append(entryId, 'I Agree');
        continue;
      }

      appendIfPresent(params, entryId, payload[field]);
    }

    const googleResponse = await fetch(FORM_RESPONSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: params.toString(),
      redirect: 'follow',
    });

    const googleHtml = await googleResponse.text();
    const wasRecorded =
      googleResponse.ok &&
      /response has been recorded|Thank you for registering/i.test(googleHtml);

    if (!wasRecorded) {
      return NextResponse.json(
        {
          success: false,
          message: 'Google Forms did not confirm the registration.',
          googleStatus: googleResponse.status,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chef podcast registration failed', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Unable to submit registration right now.',
      },
      { status: 500 }
    );
  }
}
