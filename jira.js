/**
 * /api/jira.js  — Vercel Serverless Function
 *
 * Proxies Jira REST API calls to avoid CORS issues in the browser.
 * Jira credentials (email + token) are passed in the request body
 * and never logged or stored on the server.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, email, token, jql, maxResults = 50 } = req.body || {};

  if (!domain || !email || !token || !jql) {
    return res.status(400).json({ error: 'Missing required fields: domain, email, token, jql' });
  }

  const fields = 'summary,status,issuetype,priority,assignee,updated,labels,fixVersions';
  const base64 = Buffer.from(`${email}:${token}`).toString('base64');
  const url = `https://${domain}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${fields}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Basic ${base64}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data.errorMessages?.join(', ') || `Jira API error ${upstream.status}`,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('[/api/jira] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
