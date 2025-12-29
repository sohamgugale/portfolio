require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const Anthropic = require('anthropic');
const fs = require('fs').promises;

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = {
  ml: { name: 'Machine Learning', keywords: ['learning', 'lstm', 'gan', 'neural', 'detection', 'spam', 'classification'] },
  quant: { name: 'Quantitative Finance', keywords: ['finance', 'stock', 'options', 'pricing', 'trading', 'portfolio'] },
  data: { name: 'Data Analysis', keywords: ['analysis', 'olympic', 'visualization', 'dataset', 'statistics'] },
  computation: { name: 'Computational', keywords: ['cuda', 'gpu', 'parallel', 'optimization', 'fem'] }
};

const MANUAL = {
  "Olympic-data-analysis": "Explores Olympic Games historical data using Python and Pandas. Analyzes medal distributions, country performance trends, and athlete statistics across multiple Olympic events.",
  "SMS-Spam-Detection-System-with-Python-and-NLP-Python-Pandas-NLTK-Scikit-learn-": "Classifies SMS messages as spam or legitimate using Natural Language Processing techniques. Implements NLTK for text preprocessing, TF-IDF for feature extraction, and scikit-learn for model training and evaluation.",
  "Image-Colourization-Using-GANs": "Transforms grayscale images to color using Generative Adversarial Networks. Implements a conditional GAN architecture trained on paired grayscale and color image datasets.",
  "Resume-Generation": "Generates formatted resumes from structured data using Python and LaTeX. Supports multiple template layouts and customizable section ordering."
};

async function fetchRepositories() {
  console.log('Fetching repositories...');
  const { data: repos } = await octokit.repos.listForUser({
    username: process.env.GITHUB_USERNAME,
    type: 'owner',
    sort: 'updated',
    per_page: 100
  });
  return repos.filter(repo => !repo.fork && repo.name !== process.env.GITHUB_USERNAME);
}

async function fetchRepoDetails(repo) {
  const { data: languages } = await octokit.repos.listLanguages({
    owner: repo.owner.login,
    repo: repo.name
  });
  return { ...repo, languages };
}

function categorizeProject(repo) {
  const searchText = `${repo.name} ${repo.description || ''}`.toLowerCase();
  for (const [key, category] of Object.entries(CATEGORIES)) {
    if (category.keywords.some(kw => searchText.includes(kw))) {
      return key;
    }
  }
  return 'computation';
}

async function generateDescription(repo) {
  if (MANUAL[repo.name]) {
    console.log(`  Using manual description`);
    return MANUAL[repo.name];
  }

  try {
    console.log(`  Generating AI description...`);
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Write a 2-3 sentence technical description for: ${repo.name}. Description: ${repo.description || 'No description'}. Languages: ${Object.keys(repo.languages || {}).join(', ')}. Be specific, technical, no hype.`
      }]
    });
    return message.content[0].text.trim();
  } catch (error) {
    return repo.description || 'No description available';
  }
}

async function main() {
  console.log('Starting update...\n');
  const repos = await fetchRepositories();
  console.log(`Found ${repos.length} repositories\n`);
  
  const projects = [];
  for (const repo of repos) {
    console.log(`Processing: ${repo.name}`);
    const details = await fetchRepoDetails(repo);
    const category = categorizeProject(details);
    const description = await generateDescription(details);
    
    projects.push({
      name: repo.name,
      description,
      category,
      categoryName: CATEGORIES[category].name,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      languages: details.languages,
      lastUpdated: repo.updated_at
    });
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  projects.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('data/projects.json', JSON.stringify(projects, null, 2));
  console.log(`\nSaved ${projects.length} projects`);
}

main().catch(console.error);
