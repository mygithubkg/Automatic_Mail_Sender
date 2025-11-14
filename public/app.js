const API_URL = 'http://localhost:3000/api';
let emails = [];
let templates = [];
let resumes = [];
let sendingInProgress = new Set();
let currentTemplate = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    loadEmails();
    loadTemplates();
    loadResumes();
    setupEventListeners();
});

// Navigation
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            showPage(page);
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Close mobile menu
            document.getElementById('mainNav').classList.remove('active');
        });
    });
}

function showPage(pageName) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageName).classList.add('active');
    
    // Update nav active state
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('data-page') === pageName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function toggleMobileMenu() {
    document.getElementById('mainNav').classList.toggle('active');
}

// Event Listeners
function setupEventListeners() {
    // Email form
    document.getElementById('emailForm').addEventListener('submit', handleEmailSubmit);
    
    // Template form
    document.getElementById('templateForm').addEventListener('submit', handleTemplateSubmit);
    
    // Resume upload form
    document.getElementById('resumeUploadForm').addEventListener('submit', handleResumeUpload);
    
    // Resume file input
    const resumeFileInput = document.getElementById('resumeFileInput');
    if (resumeFileInput) {
        resumeFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('resumeFileName').textContent = file.name;
                document.getElementById('uploadResumeBtn').style.display = 'inline-block';
            } else {
                document.getElementById('resumeFileName').textContent = '';
                document.getElementById('uploadResumeBtn').style.display = 'none';
            }
        });
    }
    
    // File input for bulk import
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
}

// Email Management
async function handleEmailSubmit(e) {
    e.preventDefault();
    
    // Get selected resume IDs
    const resumeCheckboxes = document.querySelectorAll('input[name="resumeIds"]:checked');
    const resumeIds = Array.from(resumeCheckboxes).map(cb => parseInt(cb.value));
    
    const formData = {
        hrName: document.getElementById('hrName').value.trim(),
        hrEmail: document.getElementById('hrEmail').value.trim(),
        company: document.getElementById('company').value.trim(),
        resumeIds: resumeIds
    };

    try {
        const response = await fetch(`${API_URL}/emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showNotification('✓ Contact added successfully!', 'success');
            document.getElementById('emailForm').reset();
            loadEmails();
            // Re-render checkboxes to restore defaults
            renderResumeCheckboxes();
        } else {
            const error = await response.json();
            showNotification('✗ ' + (error.error || 'Failed to add contact'), 'error');
        }
    } catch (error) {
        showNotification('✗ Error connecting to server', 'error');
    }
}

async function loadEmails() {
    try {
        const response = await fetch(`${API_URL}/emails`);
        emails = await response.json();
        updateStats();
        renderPendingEmails();
        renderSentEmails();
        renderRecentActivity();
    } catch (error) {
        console.error('Error loading emails:', error);
    }
}

function updateStats() {
    const total = emails.length;
    const pending = emails.filter(e => e.status === 'pending').length;
    const sent = emails.filter(e => e.status === 'sent').length;
    const failed = emails.filter(e => e.status === 'failed').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statSent').textContent = sent;
    document.getElementById('statFailed').textContent = failed;

    // Update send all buttons
    const sendAllBtns = document.querySelectorAll('#dashboardSendAllBtn, #pendingSendAllBtn');
    sendAllBtns.forEach(btn => {
        btn.disabled = pending === 0;
        btn.innerHTML = pending > 0 ? `📤 Send All Pending (${pending})` : '📤 Send All Pending';
    });
}

function renderPendingEmails() {
    const pendingEmails = emails.filter(e => e.status === 'pending' || e.status === 'sending' || e.status === 'failed');
    const container = document.getElementById('pendingEmailsContainer');
    
    if (pendingEmails.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                </svg>
                <p>No pending emails</p>
            </div>
        `;
        return;
    }

    // Store current selections before re-rendering from DOM
    pendingEmails.forEach(email => {
        const resumeSelect = document.getElementById(`resume-select-${email.id}`);
        const templateSelect = document.getElementById(`template-select-${email.id}`);
        if (resumeSelect || templateSelect) {
            if (!userSelections[email.id]) {
                userSelections[email.id] = {};
            }
            if (resumeSelect) userSelections[email.id].resume = resumeSelect.value;
            if (templateSelect) userSelections[email.id].template = templateSelect.value;
        }
    });
    
    const savedSelections = userSelections;

    let tableHTML = `
        <table class="email-table">
            <thead>
                <tr>
                    <th>HR Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    pendingEmails.forEach(email => {
        const isSending = sendingInProgress.has(email.id) || email.status === 'sending';
        const defaultResume = resumes.find(r => r.isDefault);
        const defaultTemplate = templates.find(t => t.isDefault);
        
        const savedResumeValue = (savedSelections[email.id] && savedSelections[email.id].resume) || '';
        const savedTemplateValue = (savedSelections[email.id] && savedSelections[email.id].template) || '';
        
        tableHTML += `
            <tr>
                <td colspan="5" style="padding: 0;">
                    <div style="padding: 15px;">
                        <div style="display: grid; grid-template-columns: auto 1fr auto auto auto; gap: 15px; align-items: center;">
                            <strong>${escapeHtml(email.hrName)}</strong>
                            <div style="color: #64748b; font-size: 0.9em;">
                                ${escapeHtml(email.hrEmail)} • ${escapeHtml(email.company)}
                            </div>
                            <span class="status-badge status-${email.status}">${email.status}</span>
                            <div class="action-buttons" style="margin: 0;">
                                ${email.status === 'pending' ? 
                                    `<button class="btn btn-success" onclick="sendEmailWithSelection(${email.id})" ${isSending ? 'disabled' : ''}>
                                        ${isSending ? '<span class="loading-spinner"></span> Sending...' : '📤 Send'}
                                    </button>` : 
                                    email.status === 'sending' ?
                                    `<button class="btn btn-success" disabled>
                                        <span class="loading-spinner"></span> Sending...
                                    </button>` :
                                    email.status === 'failed' ?
                                    `<button class="btn btn-success" onclick="sendEmailWithSelection(${email.id})">
                                        🔄 Retry
                                    </button>` : ''
                                }
                                <button class="btn btn-danger" onclick="deleteEmail(${email.id})" ${isSending ? 'disabled' : ''}>🗑</button>
                            </div>
                        </div>
                        
                        <div class="email-row-controls" style="margin-top: 12px;">
                            <div>
                                <label>📄 Resume:</label>
                                <select id="resume-select-${email.id}" class="email-resume-select" onchange="preserveSelection('resume', ${email.id}, this.value)">
                                    <option value="">Use Default (${defaultResume ? escapeHtml(defaultResume.name) : 'None'})</option>
                                    ${resumes.map(r => 
                                        `<option value="${r.id}" ${savedResumeValue == r.id ? 'selected' : ''}>${escapeHtml(r.name)}${r.isDefault ? ' (Default)' : ''}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div>
                                <label>📝 Template:</label>
                                <select id="template-select-${email.id}" class="email-template-select" onchange="preserveSelection('template', ${email.id}, this.value)">
                                    <option value="">Use Default (${defaultTemplate ? escapeHtml(defaultTemplate.name) : 'None'})</option>
                                    ${templates.map(t => 
                                        `<option value="${t.id}" ${savedTemplateValue == t.id ? 'selected' : ''}>${escapeHtml(t.name)}${t.isDefault ? ' (Default)' : ''}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderSentEmails() {
    const sentEmails = emails.filter(e => e.status === 'sent');
    const container = document.getElementById('sentEmailsContainer');
    
    if (sentEmails.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <p>No sent emails yet</p>
            </div>
        `;
        return;
    }

    let tableHTML = `
        <table class="email-table">
            <thead>
                <tr>
                    <th>HR Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Sent At</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    sentEmails.forEach(email => {
        const sentDate = new Date(email.sentAt);
        const formattedDate = sentDate.toLocaleString();
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(email.hrName)}</strong></td>
                <td>${escapeHtml(email.hrEmail)}</td>
                <td>${escapeHtml(email.company)}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteEmail(${email.id})">🗑 Delete</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderRecentActivity() {
    const recent = [...emails]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    
    const container = document.getElementById('recentActivity');
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8;">No recent activity</p>';
        return;
    }

    let html = '<table class="email-table"><tbody>';
    recent.forEach(email => {
        const date = new Date(email.createdAt).toLocaleString();
        html += `
            <tr>
                <td><strong>${escapeHtml(email.hrName)}</strong></td>
                <td>${escapeHtml(email.company)}</td>
                <td><span class="status-badge status-${email.status}">${email.status}</span></td>
                <td style="color: #64748b; font-size: 0.9em;">${date}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function sendEmailWithSelection(id) {
    if (sendingInProgress.has(id)) return;

    // Get selected resume and template
    const resumeSelect = document.getElementById(`resume-select-${id}`);
    const templateSelect = document.getElementById(`template-select-${id}`);
    
    const resumeId = resumeSelect ? resumeSelect.value : '';
    const templateId = templateSelect ? templateSelect.value : '';

    sendingInProgress.add(id);
    const email = emails.find(e => e.id === id);
    if (email) {
        email.status = 'sending';
        renderPendingEmails();
        renderSentEmails();
    }

    try {
        const payload = {};
        if (resumeId) payload.resumeId = parseInt(resumeId);
        if (templateId) payload.templateId = parseInt(templateId);
        
        const response = await fetch(`${API_URL}/emails/${id}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showNotification('✓ Email sent successfully!', 'success');
            await loadEmails();
        } else {
            const result = await response.json();
            showNotification('✗ ' + (result.error || 'Failed to send email'), 'error');
            await loadEmails();
        }
    } catch (error) {
        showNotification('✗ Error sending email', 'error');
        await loadEmails();
    } finally {
        sendingInProgress.delete(id);
    }
}

async function sendEmail(id) {
    // Fallback for old function calls
    await sendEmailWithSelection(id);
}

async function sendAllEmails() {
    const pendingEmails = emails.filter(e => e.status === 'pending');
    
    if (pendingEmails.length === 0) {
        showNotification('ℹ No pending emails to send', 'info');
        return;
    }

    if (!confirm(`Are you sure you want to send ${pendingEmails.length} email(s) with default settings?`)) {
        return;
    }

    // Get bulk default selections
    const bulkResumeId = document.getElementById('bulkResumeSelect')?.value;
    const bulkTemplateId = document.getElementById('bulkTemplateSelect')?.value;

    showNotification(`📤 Sending ${pendingEmails.length} email(s) with defaults...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (const email of pendingEmails) {
        try {
            const payload = {};
            if (bulkResumeId) payload.resumeId = parseInt(bulkResumeId);
            if (bulkTemplateId) payload.templateId = parseInt(bulkTemplateId);
            
            const response = await fetch(`${API_URL}/emails/${email.id}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
            
            await loadEmails();
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            failCount++;
        }
    }

    if (failCount === 0) {
        showNotification(`✓ All ${successCount} email(s) sent successfully!`, 'success');
    } else {
        showNotification(`⚠ Sent ${successCount}, Failed ${failCount}`, 'error');
    }

    loadEmails();
}

async function deleteEmail(id) {
    if (!confirm('Are you sure you want to delete this email?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/emails/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('✓ Email deleted successfully!', 'success');
            // Clear saved selections for this email
            delete userSelections[id];
            loadEmails();
        } else {
            showNotification('✗ Failed to delete email', 'error');
        }
    } catch (error) {
        showNotification('✗ Error deleting email', 'error');
    }
}

// File Import
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name;
    document.getElementById('fileName').textContent = fileName;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        const extension = fileName.split('.').pop().toLowerCase();

        try {
            let contacts = [];

            if (extension === 'json') {
                contacts = parseJSON(content);
            } else if (extension === 'csv') {
                contacts = parseCSV(content);
            } else {
                showNotification('✗ Unsupported file format', 'error');
                return;
            }

            if (contacts.length === 0) {
                showNotification('✗ No valid contacts found', 'error');
                return;
            }

            importContacts(contacts);
        } catch (error) {
            showNotification('✗ Error parsing file: ' + error.message, 'error');
        }
    };

    reader.readAsText(file);
}

function parseJSON(content) {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
        throw new Error('JSON must be an array');
    }
    return data.filter(c => c.hrName && c.hrEmail && c.company);
}

function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have header and data');

    const headers = lines[0].split(',').map(h => h.trim());
    const required = ['hrName', 'hrEmail', 'company'];
    
    if (!required.every(h => headers.includes(h))) {
        throw new Error('CSV must have: hrName, hrEmail, company');
    }

    const indices = {
        hrName: headers.indexOf('hrName'),
        hrEmail: headers.indexOf('hrEmail'),
        company: headers.indexOf('company')
    };

    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const contact = {
            hrName: values[indices.hrName],
            hrEmail: values[indices.hrEmail],
            company: values[indices.company]
        };
        if (contact.hrName && contact.hrEmail && contact.company) {
            contacts.push(contact);
        }
    }
    return contacts;
}

async function importContacts(contacts) {
    if (!confirm(`Import ${contacts.length} contact(s)?`)) return;

    showNotification(`📥 Importing ${contacts.length} contact(s)...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (const contact of contacts) {
        try {
            const response = await fetch(`${API_URL}/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contact)
            });

            if (response.ok) successCount++;
            else failCount++;

            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failCount++;
        }
    }

    document.getElementById('fileInput').value = '';
    document.getElementById('fileName').textContent = '';

    if (failCount === 0) {
        showNotification(`✓ Imported ${successCount} contact(s)!`, 'success');
    } else {
        showNotification(`⚠ Imported ${successCount}, Failed ${failCount}`, 'error');
    }

    loadEmails();
}

// Template Management
async function loadTemplates() {
    try {
        const response = await fetch(`${API_URL}/templates`);
        templates = await response.json();
        renderTemplates();
        populateTemplateSelects();
    } catch (error) {
        // Templates endpoint doesn't exist yet, use default template
        templates = [{
            id: 1,
            name: 'Default Template',
            subject: 'Application for position at {{COMPANY_NAME}}',
            content: 'Dear {{HR_NAME}},\n\nI hope this email finds you well. I am writing to express my interest in opportunities at {{COMPANY_NAME}}.\n\nBest regards',
            isDefault: true
        }];
        renderTemplates();
        populateTemplateSelects();
    }
}

function renderTemplates() {
    const container = document.getElementById('templateList');
    
    if (templates.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8;">No templates yet. Create your first template below.</p>';
        return;
    }

    let html = '';
    templates.forEach(template => {
        const isDefault = template.isDefault || false;
        html += `
            <div class="template-card ${isDefault ? 'default-template' : ''} ${currentTemplate === template.id ? 'active' : ''}" onclick="editTemplate(${template.id})">
                <h3>
                    ${escapeHtml(template.name)}
                    ${isDefault ? '<span class="template-badge">⭐ Default</span>' : ''}
                </h3>
                <div class="template-preview">${escapeHtml(template.content.substring(0, 100))}...</div>
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); editTemplate(${template.id})">✏️ Edit</button>
                    ${!isDefault ? 
                        `<button class="btn btn-success" onclick="event.stopPropagation(); setDefaultTemplate(${template.id})">⭐ Set Default</button>` : 
                        `<button class="btn btn-secondary" disabled>⭐ Default</button>`
                    }
                    <button class="btn btn-danger" onclick="event.stopPropagation(); deleteTemplate(${template.id})">🗑 Delete</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function populateTemplateSelects() {
    const bulkSelect = document.getElementById('bulkTemplateSelect');
    if (!bulkSelect) return;
    
    const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
    
    let html = '<option value="">No Template</option>';
    templates.forEach(template => {
        const selected = template.id === (defaultTemplate ? defaultTemplate.id : null) ? 'selected' : '';
        html += `<option value="${template.id}" ${selected}>${escapeHtml(template.name)}${template.isDefault ? ' (Default)' : ''}</option>`;
    });
    
    bulkSelect.innerHTML = html;
}

function editTemplate(id) {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    currentTemplate = id;
    document.getElementById('templateId').value = id;
    document.getElementById('templateName').value = template.name;
    document.getElementById('templateSubject').value = template.subject;
    document.getElementById('templateContent').value = template.content;
    document.getElementById('templateIsDefault').checked = template.isDefault || false;
    document.getElementById('templateEditorTitle').textContent = 'Edit Template';
    
    renderTemplates();
}

function resetTemplateForm() {
    currentTemplate = null;
    document.getElementById('templateForm').reset();
    document.getElementById('templateId').value = '';
    document.getElementById('templateIsDefault').checked = false;
    document.getElementById('templateEditorTitle').textContent = 'Create New Template';
    renderTemplates();
}

async function handleTemplateSubmit(e) {
    e.preventDefault();
    
    const isDefault = document.getElementById('templateIsDefault').checked;
    
    const templateData = {
        name: document.getElementById('templateName').value.trim(),
        subject: document.getElementById('templateSubject').value.trim(),
        content: document.getElementById('templateContent').value.trim(),
        isDefault: isDefault
    };

    const templateId = document.getElementById('templateId').value;
    
    try {
        if (templateId) {
            // Update existing template via API
            const response = await fetch(`${API_URL}/templates/${templateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
            });

            if (response.ok) {
                showNotification('✓ Template updated!', 'success');
                await loadTemplates();
            } else {
                const error = await response.json();
                showNotification('✗ ' + (error.error || 'Failed to update template'), 'error');
            }
        } else {
            // Create new template via API
            const response = await fetch(`${API_URL}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
            });

            if (response.ok) {
                showNotification('✓ Template created!', 'success');
                await loadTemplates();
            } else {
                const error = await response.json();
                showNotification('✗ ' + (error.error || 'Failed to create template'), 'error');
            }
        }

        resetTemplateForm();
    } catch (error) {
        showNotification('✗ Error saving template', 'error');
    }
}

async function setDefaultTemplate(id) {
    try {
        const response = await fetch(`${API_URL}/templates/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isDefault: true })
        });

        if (response.ok) {
            showNotification('✓ Default template updated!', 'success');
            await loadTemplates();
        } else {
            const error = await response.json();
            showNotification('✗ ' + (error.error || 'Failed to set default template'), 'error');
        }
    } catch (error) {
        showNotification('✗ Error updating default template', 'error');
    }
}

async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    
    try {
        const response = await fetch(`${API_URL}/templates/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('✓ Template deleted!', 'success');
            await loadTemplates();
        } else {
            const error = await response.json();
            showNotification('✗ ' + (error.error || 'Failed to delete template'), 'error');
        }
    } catch (error) {
        showNotification('✗ Error deleting template', 'error');
    }
}

// Store user selections to persist across re-renders
const userSelections = {};

function preserveSelection(type, emailId, value) {
    if (!userSelections[emailId]) {
        userSelections[emailId] = {};
    }
    userSelections[emailId][type] = value;
}

// Utilities
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 4000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Resume Management
async function loadResumes() {
    try {
        const response = await fetch(`${API_URL}/resumes`);
        resumes = await response.json();
        renderResumes();
        renderResumeCheckboxes();
        populateBulkResumeSelect();
    } catch (error) {
        console.error('Error loading resumes:', error);
    }
}

function populateBulkResumeSelect() {
    const bulkSelect = document.getElementById('bulkResumeSelect');
    if (!bulkSelect) return;
    
    const defaultResume = resumes.find(r => r.isDefault) || resumes[0];
    
    let html = '<option value="">No Resume</option>';
    resumes.forEach(resume => {
        const selected = resume.id === (defaultResume ? defaultResume.id : null) ? 'selected' : '';
        html += `<option value="${resume.id}" ${selected}>${escapeHtml(resume.name)}${resume.isDefault ? ' (Default)' : ''}</option>`;
    });
    
    bulkSelect.innerHTML = html;
}

function renderResumes() {
    const container = document.getElementById('resumeList');
    
    if (resumes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
                </svg>
                <p>No resumes uploaded yet</p>
            </div>
        `;
        return;
    }

    let html = '<div class="resume-grid">';
    resumes.forEach(resume => {
        const uploadDate = new Date(resume.uploadedAt).toLocaleDateString();
        const fileSize = (resume.fileSize / 1024).toFixed(1) + ' KB';
        
        html += `
            <div class="resume-item ${resume.isDefault ? 'default' : ''}">
                <div class="resume-header">
                    <h3>📄 ${escapeHtml(resume.name)}</h3>
                    ${resume.isDefault ? '<span class="resume-badge">Default</span>' : ''}
                </div>
                <div class="resume-info">
                    <p><strong>File:</strong> ${escapeHtml(resume.filename)}</p>
                    <p><strong>Size:</strong> ${fileSize}</p>
                    <p><strong>Uploaded:</strong> ${uploadDate}</p>
                </div>
                <div class="action-buttons">
                    ${!resume.isDefault ? 
                        `<button class="btn btn-primary" onclick="setDefaultResume(${resume.id})">⭐ Set as Default</button>` :
                        `<button class="btn btn-secondary" disabled>⭐ Default Resume</button>`
                    }
                    <button class="btn btn-danger" onclick="deleteResume(${resume.id})">🗑 Delete</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderResumeCheckboxes() {
    const container = document.getElementById('resumeCheckboxes');
    
    if (resumes.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; font-size: 0.9em;">No resumes available. <a href="#" onclick="showPage(\'resumes\'); return false;">Upload a resume</a></p>';
        return;
    }

    let html = '<div class="checkbox-list">';
    resumes.forEach(resume => {
        const checked = resume.isDefault ? 'checked' : '';
        html += `
            <div class="checkbox-item">
                <input type="checkbox" id="resume_${resume.id}" name="resumeIds" value="${resume.id}" ${checked}>
                <label for="resume_${resume.id}">${escapeHtml(resume.name)} ${resume.isDefault ? '(Default)' : ''}</label>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function handleResumeUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('resumeFileInput');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showNotification('✗ Please select a file', 'error');
        return;
    }

    const file = fileInput.files[0];
    const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension for display name

    // Validate file type
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
        showNotification('✗ Only PDF, DOC, and DOCX files are allowed', 'error');
        return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('✗ File size must be less than 10MB', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('name', name);

    try {
        const response = await fetch(`${API_URL}/resumes`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showNotification('✓ Resume uploaded successfully!', 'success');
            document.getElementById('resumeUploadForm').reset();
            document.getElementById('resumeFileName').textContent = '';
            document.getElementById('uploadResumeBtn').style.display = 'none';
            await loadResumes();
        } else {
            const error = await response.json();
            showNotification('✗ ' + (error.error || 'Failed to upload resume'), 'error');
        }
    } catch (error) {
        showNotification('✗ Error uploading resume', 'error');
    }
}

async function setDefaultResume(id) {
    try {
        const response = await fetch(`${API_URL}/resumes/${id}/default`, {
            method: 'PATCH'
        });

        if (response.ok) {
            showNotification('✓ Default resume updated!', 'success');
            await loadResumes();
        } else {
            const error = await response.json();
            showNotification('✗ ' + (error.error || 'Failed to set default resume'), 'error');
        }
    } catch (error) {
        showNotification('✗ Error updating default resume', 'error');
    }
}

async function deleteResume(id) {
    if (!confirm('Are you sure you want to delete this resume?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/resumes/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('✓ Resume deleted successfully!', 'success');
            await loadResumes();
        } else {
            const error = await response.json();
            showNotification('✗ ' + (error.error || 'Failed to delete resume'), 'error');
        }
    } catch (error) {
        showNotification('✗ Error deleting resume', 'error');
    }
}

// Auto-refresh - only reload if not on pending page or no selections made
setInterval(() => {
    if (sendingInProgress.size === 0) {
        const pendingPage = document.getElementById('pending');
        const isOnPendingPage = pendingPage && pendingPage.classList.contains('active');
        
        // Don't auto-refresh if user is on pending page and has made selections
        if (!isOnPendingPage || Object.keys(userSelections).length === 0) {
            loadEmails();
        }
    }
}, 10000);
