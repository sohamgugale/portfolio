require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = {
  ml: { name: 'Machine Learning', keywords: ['learning', 'lstm', 'gan', 'neural', 'detection', 'spam', 'classification', 'image', 'colourization', 'colorization', 'sentiment', 'nlp'] },
  quant: { name: 'Quantitative Finance', keywords: ['finance', 'stock', 'options', 'pricing', 'trading', 'portfolio', 'black-scholes', 'derivatives', 'forecasting', 'sharpe', 'roi', 'chess'] },
  data: { name: 'Data Analytics', keywords: ['analysis', 'olympic', 'visualization', 'dataset', 'statistics', 'ipl', 'cricket', 'dashboard', 'metrics', 'business'] },
  computation: { name: 'High Performance Computing', keywords: ['cuda', 'gpu', 'parallel', 'optimization', 'fem', 'computational', 'acceleration'] }
};

const RELEVANT_PROJECTS = [
  'olympic', 'data', 'analysis', 'spam', 'detection', 'sms', 'image', 'colourization', 'colorization', 
  'gan', 'stock', 'forecasting', 'lstm', 'sentiment', 'portfolio', 'chess', 'roi', 'opening', 'ipl', 
  'cricket', 'business', 'analytics', 'dashboard', 'finance', 'options', 'pricing', 'cuda', 'gpu'
];

async function fetchRepositories() {
  console.log('Fetching repositories...');
  const { data: repos } = await octokit.repos.listForUser({
    username: process.env.GITHUB_USERNAME,
    type: 'owner',
    sort: 'updated',
    per_page: 100
  });
  
  const filtered = repos.filter(repo => {
    if (repo.fork || repo.name === process.env.GITHUB_USERNAME || repo.name === 'portfolio') return false;
    const name = repo.name.toLowerCase();
    return RELEVANT_PROJECTS.some(keyword => name.includes(keyword));
  });
  
  console.log(`Found ${filtered.length} relevant repositories (from ${repos.length} total)`);
  return filtered;
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
  return 'data';
}

async function generateDescription(repo, category) {
  try {
    console.log(`  Generating description...`);
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Write a professional 2-3 sentence description for this ${CATEGORIES[category].name} project.

Project: ${repo.name}
Original: ${repo.description || 'No description'}
Languages: ${Object.keys(repo.languages || {}).join(', ')}

Requirements: Technical, specific about methods/algorithms, present tense, no hype words, under 100 words.`
      }]
    });
    return message.content[0].text.trim();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return repo.description || 'Advanced computational project';
  }
}

async function main() {
  console.log('🚀 Updating portfolio...\n');
  const repos = await fetchRepositories();
  
  const projects = [];
  for (const repo of repos) {
    console.log(`\nProcessing: ${repo.name}`);
    const details = await fetchRepoDetails(repo);
    const category = categorizeProject(details);
    const description = await generateDescription(details, category);
    
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
    
    await new Promise(r => setTimeout(r, 1200));
  }
  
  projects.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('data/projects.json', JSON.stringify(projects, null, 2));
  
  console.log(`\n✅ Saved ${projects.length} projects`);
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const count = projects.filter(p => p.category === key).length;
    if (count > 0) console.log(`  ${cat.name}: ${count}`);
  });
}

main().catch(console.error);
