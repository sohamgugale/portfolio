let allProjects = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadProjects();
    setupFilters();
    updateLastUpdated();
    smoothScroll();
});

async function loadProjects() {
    try {
        const response = await fetch('data/projects.json');
        allProjects = await response.json();
        displayProjects(allProjects);
    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('projectsGrid').innerHTML = '<div class="loading"><p>Error loading projects.</p></div>';
    }
}

function displayProjects(projects) {
    const grid = document.getElementById('projectsGrid');
    
    if (projects.length === 0) {
        grid.innerHTML = '<div class="loading"><p>No projects found.</p></div>';
        return;
    }

    grid.innerHTML = projects.map(project => {
        const langs = Object.keys(project.languages || {}).slice(0, 4);
        return `
        <div class="project-card" data-category="${project.category}" onclick="window.open('${project.url}', '_blank')">
            <div class="project-header">
                <h3 class="project-title">${project.name}</h3>
                <span class="project-category">${project.categoryName}</span>
            </div>
            <p class="project-description">${project.description}</p>
            <div class="project-meta">
                ${project.stars > 0 ? `<span>⭐ ${project.stars}</span>` : ''}
                ${project.language ? `<span>💻 ${project.language}</span>` : ''}
                <span>📅 ${formatDate(project.lastUpdated)}</span>
            </div>
            ${langs.length > 0 ? `<div class="project-tech">${langs.map(l => `<span class="tech-tag">${l}</span>`).join('')}</div>` : ''}
        </div>
        `;
    }).join('');
}

function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const cards = document.querySelectorAll('.project-card');
            cards.forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateLastUpdated() {
    const updateSpan = document.getElementById('lastUpdate');
    const now = new Date();
    updateSpan.textContent = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function smoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}
