require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Only include graduate-level, job-market relevant projects
const WHITELIST = [
  'Olympic-data-analysis',
  'SMS-Spam-Detection-System-with-Python-and-NLP-Python-Pandas-NLTK-Scikit-learn-',
  'Image-Colourization-Using-GANs',
  'Stock-Price-Prediction',
  'Options-Pricing',
  'Black-Scholes-Model',
  'CUDA-Image-Processing',
  'GPU-Acceleration',
  'LSTM-Stock-Forecasting',
  'Portfolio-Optimization',
  'Financial-Derivatives',
  'Deep-Learning-Classification',
  'NLP-Text-Analysis',
  'Time-Series-Analysis',
  'FEM-Analysis',
  'Structural-Optimization',
  'Computational-Mechanics',
  'Parallel-Computing'
];

const CATEGORIES = {
  ml: { 
    name: 'Machine Learning',
    keywords: ['learning', 'lstm', 'gan', 'neural', 'detection', 'spam', 'classification', 'deep', 'nlp', 'text', 'image', 'colourization', 'colorization'],
    description: 'Deep learning and machine learning applications'
  },
  quant: { 
    name: 'Quantitative Finance',
    keywords: ['finance', 'stock', 'options', 'pricing', 'trading', 'portfolio', 'black-scholes', 'derivatives', 'forecasting'],
    description: 'Financial modeling and quantitative analysis'
  },
  data: { 
    name: 'Data Analysis',
    keywords: ['analysis', 'olympic', 'visualization', 'dataset', 'statistics', 'time-series'],
    description: 'Statistical analysis and data visualization'
  },
  computation: { 
    name: 'High Performance Computing',
    keywords: ['cuda', 'gpu', 'parallel', 'optimization', 'fem', 'computational', 'acceleration', 'mechanics', 'structural'],
    description: 'GPU computing and computational mechanics'
  }
};

const MANUAL = {
  "Olympic-data-analysis": "Statistical analysis of Olympic Games historical data using Python and Pandas. Explores medal distributions, country performance trends, and athlete demographics across multiple Olympic cycles. Implements data visualization techniques to identify patterns in competitive sports.",
  
  "SMS-Spam-Detection-System-with-Python-and-NLP-Python-Pandas-NLTK-Scikit-learn-": "Text classification system for spam detection using Natural Language Processing. Implements TF-IDF vectorization for feature extraction and compares multiple scikit-learn classifiers. Achieves high accuracy through systematic preprocessing with NLTK and model evaluation.",
  
  "Image-Colourization-Using-GANs": "Generative Adversarial Network for automated image colorization. Implements conditional GAN architecture trained on paired grayscale and color datasets. Demonstrates adversarial training techniques for image-to-image translation tasks.",
  
  "LSTM-Stock-Forecasting": "Stock price prediction using Long Short-Term Memory networks. Implements time series forecasting with feature engineering from historical price data. Evaluates model performance using standard financial metrics and backtesting.",
  
  "Options-Pricing": "Options pricing engine implementing Black-Scholes model and Monte Carlo simulations. Calculates theoretical values for European and American options with Greeks computation. Provides risk analysis framework for derivatives trading.",
  
  "CUDA-Image-Processing": "GPU-accelerated image processing using CUDA programming. Implements parallel algorithms for convolution, filtering, and transformation operations. Demonstrates significant performance improvements over CPU implementations.",
  
  "Portfolio-Optimization": "Mean-variance portfolio optimization using modern portfolio theory. Implements efficient frontier calculation and Sharpe ratio maximization. Provides asset allocation strategies based on risk-return tradeoffs."
};

async function fetchRepositories() {
  console.log('Fetching repositories...');
  const { data: repos } = await octokit.repos.listForUser({
    username: process.env.GITHUB_USERNAME,
    type: 'owner',
    sort: 'updated',
    per_page: 100
  });
  
  // Filter for whitelisted projects only
  const filtered = repos.filter(repo => 
    !repo.fork && 
    repo.name !== process.env.GITHUB_USERNAME &&
    WHITELIST.some(name => repo.name.toLowerCase().includes(name.toLowerCase()))
  );
  
  console.log(`Found ${filtered.length} relevant repositories (filtered from ${repos.length} total)`);
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
  return 'computation';
}

async function generateDescription(repo, category) {
  if (MANUAL[repo.name]) {
    console.log(`  Using manual description`);
    return MANUAL[repo.name];
  }

  try {
    console.log(`  Generating AI description...`);
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a professional 2-3 sentence description for this graduate-level ${CATEGORIES[category].name} project.

Project: ${repo.name}
Category: ${CATEGORIES[category].description}
Original description: ${repo.description || 'No description'}
Languages: ${Object.keys(repo.languages || {}).join(', ')}

Focus on: technical implementation, algorithms/methods used, and practical applications. Use present tense. Be specific and technical. No hype words.`
      }]
    });
    return message.content[0].text.trim();
  } catch (error) {
    console.error(`Error generating description: ${error.message}`);
    return repo.description || 'Advanced computational project';
  }
}

async function main() {
  console.log('🚀 Starting portfolio update...\n');
  const repos = await fetchRepositories();
  
  if (repos.length === 0) {
    console.log('⚠️  No matching projects found. Check your repository names.');
    return;
  }
  
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
  
  console.log(`\n✅ Saved ${projects.length} graduate-level projects`);
  console.log('\nProjects by category:');
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const count = projects.filter(p => p.category === key).length;
    if (count > 0) console.log(`  ${cat.name}: ${count}`);
  });
}

main().catch(console.error);
