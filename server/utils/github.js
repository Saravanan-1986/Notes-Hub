const axios = require('axios');

const CENTRAL_USERNAME = process.env.GITHUB_USERNAME;
const CENTRAL_TOKEN = process.env.GITHUB_TOKEN;

if (!CENTRAL_USERNAME || !CENTRAL_TOKEN) {
  console.error('GITHUB_USERNAME and GITHUB_TOKEN must be set in .env');
  process.exit(1);
}

const BASE_URL = 'https://api.github.com';
const HEADERS = {
  Authorization: `token ${CENTRAL_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'Notes-Hub'
};

class GitHubService {
  /**
   * Get or create a repo for a user.
   * Returns the repo name with available space.
   * Format: notes-hub-{userId}-{index}
   */
  static async getOrCreateRepo(userId) {
    const baseName = `notes-hub-${userId}`;
    let index = 1;

    // Try existing repos first
    while (true) {
      const repoName = index === 1 ? baseName : `${baseName}-${index}`;
      
      try {
        // Check if repo exists and its size
        const { data: repoData } = await axios.get(
          `${BASE_URL}/repos/${CENTRAL_USERNAME}/${repoName}`,
          { headers: HEADERS }
        );

        // GitHub repos have a 1GB soft limit for free accounts
        // We'll use a 500MB safety margin
        const sizeMB = (repoData.size / 1024).toFixed(2); // size is in KB
        console.log(`Repo ${repoName}: ${sizeMB}MB used`);

        if (repoData.size < 500 * 1024) { // less than 500MB
          return repoName;
        }
        // Repo is full, try next
        index++;
      } catch (err) {
        if (err.response?.status === 404) {
          // Repo doesn't exist - create it
          return await GitHubService._createRepo(repoName);
        }
        throw err;
      }
    }
  }

  /**
   * Create a new repo
   */
  static async _createRepo(repoName) {
    try {
      await axios.post(
        `${BASE_URL}/user/repos`,
        {
          name: repoName,
          private: false,
          auto_init: false,
          description: 'Notes Hub - Study materials'
        },
        { headers: HEADERS }
      );
      console.log(`Repo ${repoName} created successfully`);
      return repoName;
    } catch (err) {
      if (err.response?.status === 422) {
        console.log(`Repo ${repoName} already exists`);
        return repoName;
      }
      throw err;
    }
  }

  /**
   * Initialize a repo with a .gitkeep (since auto_init is false)
   */
  static async initRepo(repoName) {
    try {
      // Create an initial commit to initialize the repo
      const { data: refData } = await axios.post(
        `${BASE_URL}/repos/${CENTRAL_USERNAME}/${repoName}/git/refs`,
        {
          ref: 'refs/heads/main',
          sha: '0000000000000000000000000000000000000000'
        },
        { headers: HEADERS }
      );
    } catch (err) {
      // Repo likely already has commits, that's fine
    }
  }

  /**
   * Upload file to a user's repo
   */
  static async uploadFile(userId, path, contentBase64, message = 'Upload note') {
    const repoName = await GitHubService.getOrCreateRepo(userId);
    
    try {
      const response = await axios.put(
        `${BASE_URL}/repos/${CENTRAL_USERNAME}/${repoName}/contents/${path}`,
        { message, content: contentBase64 },
        { headers: HEADERS }
      );
      return { repoName, data: response.data };
    } catch (err) {
      if (err.response?.status === 422) {
        throw new Error('File already exists. Cannot overwrite.');
      }
      throw err;
    }
  }

  /**
   * Get file bytes from a specific repo.
   * GitHub's contents API can omit base64 content for larger files, so fall
   * back to the provided download_url when needed.
   */
  static async getFileBuffer(repoName, path) {
    const response = await axios.get(
      `${BASE_URL}/repos/${CENTRAL_USERNAME}/${repoName}/contents/${path}`,
      { headers: HEADERS }
    );

    if (response.data.content && response.data.encoding === 'base64') {
      return Buffer.from(response.data.content.replace(/\s/g, ''), 'base64');
    }

    if (response.data.download_url) {
      const rawResponse = await axios.get(response.data.download_url, {
        headers: { Authorization: `token ${CENTRAL_TOKEN}`, 'User-Agent': 'Notes-Hub' },
        responseType: 'arraybuffer'
      });
      return Buffer.from(rawResponse.data);
    }

    throw new Error('GitHub did not return readable file content');
  }

  static async getFile(repoName, path) {
    return (await GitHubService.getFileBuffer(repoName, path)).toString('base64');
  }

  /**
   * Get SHA of a file (needed for delete/update)
   */
  static async getFileSha(repoName, path) {
    const response = await axios.get(
      `${BASE_URL}/repos/${CENTRAL_USERNAME}/${repoName}/contents/${path}`,
      { headers: HEADERS }
    );
    return response.data.sha;
  }

  /**
   * Delete a file from GitHub
   */
  static async deleteFile(repoName, path, sha, message = 'Delete note') {
    await axios.delete(
      `${BASE_URL}/repos/${CENTRAL_USERNAME}/${repoName}/contents/${path}`,
      {
        headers: HEADERS,
        data: { message, sha }
      }
    );
  }

  /**
   * Upload file to a specific repo (used when repo is already known)
   */
  static async uploadFileToRepo(repoName, path, contentBase64, message = 'Upload note') {
    const response = await axios.put(
      `${BASE_URL}/repos/${CENTRAL_USERNAME}/${repoName}/contents/${path}`,
      { message, content: contentBase64 },
      { headers: HEADERS }
    );
    return response.data;
  }
}

module.exports = GitHubService;
