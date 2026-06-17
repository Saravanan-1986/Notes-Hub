const axios = require('axios');

class GitHubService {
  constructor(token, username) {
    this.token = token;
    this.username = username;
    this.baseURL = 'https://api.github.com';
    this.headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Notes-Hub'
    };
  }

  // Create repo if not exists (lazy creation)
  async createRepo() {
    const repoName = `${this.username}-notes`;
    try {
      await axios.post(
        `${this.baseURL}/user/repos`,
        {
          name: repoName,
          private: false,
          auto_init: true,
          description: 'Notes Hub - Encrypted study materials'
        },
        { headers: this.headers }
      );
      console.log(`Repo ${repoName} created`);
      return repoName;
    } catch (err) {
      if (err.response?.status === 422) {
        console.log(`Repo ${repoName} already exists`);
        return repoName;
      }
      throw err;
    }
  }

  // Upload encrypted file to GitHub
  async uploadFile(path, contentBase64, message = 'Upload note') {
    const repoName = `${this.username}-notes`;
    
    try {
      const response = await axios.put(
        `${this.baseURL}/repos/${this.username}/${repoName}/contents/${path}`,
        {
          message,
          content: contentBase64
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (err) {
      if (err.response?.status === 422) {
        throw new Error('File already exists. Use update instead.');
      }
      throw err;
    }
  }

  // Get file content from GitHub
  async getFile(path) {
    const repoName = `${this.username}-notes`;
    
    const response = await axios.get(
      `${this.baseURL}/repos/${this.username}/${repoName}/contents/${path}`,
      { headers: this.headers }
    );
    
    return response.data.content; // Base64 encoded
  }

  // Delete file from GitHub
  async deleteFile(path, sha, message = 'Delete note') {
    const repoName = `${this.username}-notes`;
    
    await axios.delete(
      `${this.baseURL}/repos/${this.username}/${repoName}/contents/${path}`,
      {
        headers: this.headers,
        data: { message, sha }
      }
    );
  }
}

module.exports = GitHubService;