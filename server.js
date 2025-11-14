const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'Resumes';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype) || 
                         file.mimetype === 'application/msword' ||
                         file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Persistent storage file
const DATA_FILE = 'emails-data.json';
const RESUMES_FILE = 'resumes-data.json';
const TEMPLATES_FILE = 'templates-data.json';

// Load emails from file or initialize empty
let emails = [];
let emailIdCounter = 1;

function loadEmailsFromFile() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            emails = data.emails || [];
            emailIdCounter = data.emailIdCounter || 1;
            console.log(`Loaded ${emails.length} emails from storage`);
        }
    } catch (error) {
        console.error('Error loading emails from file:', error);
        emails = [];
        emailIdCounter = 1;
    }
}

function saveEmailsToFile() {
    try {
        const data = {
            emails: emails,
            emailIdCounter: emailIdCounter,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving emails to file:', error);
    }
}

// Resume management
let resumes = [];
let resumeIdCounter = 1;

function loadResumesFromFile() {
    try {
        if (fs.existsSync(RESUMES_FILE)) {
            const data = JSON.parse(fs.readFileSync(RESUMES_FILE, 'utf8'));
            resumes = data.resumes || [];
            resumeIdCounter = data.resumeIdCounter || 1;
            console.log(`Loaded ${resumes.length} resumes from storage`);
        }
    } catch (error) {
        console.error('Error loading resumes from file:', error);
        resumes = [];
        resumeIdCounter = 1;
    }
}

function saveResumesToFile() {
    try {
        const data = {
            resumes: resumes,
            resumeIdCounter: resumeIdCounter,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(RESUMES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving resumes to file:', error);
    }
}

// Load emails on startup
loadEmailsFromFile();
loadResumesFromFile();

// Templates storage
let templates = [];
let templateIdCounter = 1;

function loadTemplatesFromFile() {
    try {
        if (fs.existsSync(TEMPLATES_FILE)) {
            const data = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
            templates = data.templates || [];
            templateIdCounter = data.templateIdCounter || 1;
            console.log(`Loaded ${templates.length} templates from storage`);
        } else {
            // Initialize with default professional template if file doesn't exist
            templates = [
                {
                    id: 1,
                    name: 'Professional Template',
                    subject: 'Engineering Internship Application - {{COMPANY_NAME}}',
                    content: 'Dear {{HR_NAME}},\n\nI hope this email finds you well.\n\nI am writing to express my strong interest in exploring internship opportunities at {{COMPANY_NAME}}. As a third-year engineering student with hands-on experience in software development and artificial intelligence, I am eager to contribute to your team\'s success.\n\nI have been following {{COMPANY_NAME}}\'s innovative work in the industry, and I am particularly impressed by your commitment to technological excellence. I believe my technical skills and passion for problem-solving would make me a valuable addition to your organization.\n\nI have attached my resume for your review, which details my technical expertise and project experience. I would be grateful for the opportunity to discuss how I can contribute to {{COMPANY_NAME}}\'s goals.\n\nThank you very much for considering my application. I look forward to the possibility of speaking with you.\n\nBest regards,\nKarrtik Gupta\nLinkedIn: linkedin.com/in/karttik-gupta\nPortfolio: kartikgupta.vercel.app',
                    isDefault: true
                }
            ];
            templateIdCounter = 2;
            saveTemplatesToFile();
        }
    } catch (error) {
        console.error('Error loading templates from file:', error);
        templates = [
            {
                id: 1,
                name: 'Professional Template',
                subject: 'Engineering Internship Application - {{COMPANY_NAME}}',
                content: 'Dear {{HR_NAME}},\n\nI hope this email finds you well.\n\nI am writing to express my strong interest in exploring internship opportunities at {{COMPANY_NAME}}. As a third-year engineering student with hands-on experience in software development and artificial intelligence, I am eager to contribute to your team\'s success.\n\nI have been following {{COMPANY_NAME}}\'s innovative work in the industry, and I am particularly impressed by your commitment to technological excellence. I believe my technical skills and passion for problem-solving would make me a valuable addition to your organization.\n\nI have attached my resume for your review, which details my technical expertise and project experience. I would be grateful for the opportunity to discuss how I can contribute to {{COMPANY_NAME}}\'s goals.\n\nThank you very much for considering my application. I look forward to the possibility of speaking with you.\n\nBest regards,\nKarrtik Gupta\nLinkedIn: linkedin.com/in/karttik-gupta\nPortfolio: kartikgupta.vercel.app',
                isDefault: true
            }
        ];
        templateIdCounter = 2;
    }
}

function saveTemplatesToFile() {
    try {
        const data = {
            templates: templates,
            templateIdCounter: templateIdCounter,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving templates to file:', error);
    }
}

// Load templates on startup
loadTemplatesFromFile();

// Load email configuration
let emailConfig = {};
try {
    emailConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (error) {
    console.log('Warning: config.json not found. Please create it with your email settings.');
}

// Create nodemailer transporter
let transporter = null;
if (emailConfig.email && emailConfig.password) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailConfig.email,
            pass: emailConfig.password
        }
    });
}

// Load email template
function loadTemplate() {
    try {
        return fs.readFileSync('email-template.html', 'utf8');
    } catch (error) {
        console.error('Error loading template:', error);
        return '<p>Hello {{HR_NAME}},</p><p>I am interested in opportunities at {{COMPANY_NAME}}.</p>';
    }
}

// Replace template variables
function populateTemplate(template, hrName, company) {
    return template
        .replace(/{{HR_NAME}}/g, hrName)
        .replace(/{{COMPANY_NAME}}/g, company);
}

// API Routes

// Get all emails
app.get('/api/emails', (req, res) => {
    res.json(emails);
});

// Add new email
app.post('/api/emails', (req, res) => {
    const { hrName, hrEmail, company, resumeIds } = req.body;
    
    if (!hrName || !hrEmail || !company) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const newEmail = {
        id: emailIdCounter++,
        hrName,
        hrEmail,
        company,
        resumeIds: resumeIds || [],
        status: 'pending',
        createdAt: new Date().toISOString(),
        sentAt: null
    };
    
    emails.push(newEmail);
    saveEmailsToFile();
    res.json(newEmail);
});

// Send email
app.post('/api/emails/:id/send', async (req, res) => {
    const emailId = parseInt(req.params.id);
    const email = emails.find(e => e.id === emailId);
    
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }
    
    if (!transporter) {
        return res.status(500).json({ error: 'Email service not configured. Please check config.json' });
    }
    
    // Update status to sending
    email.status = 'sending';
    
    try {
        // Get resume and template from request body or use defaults
        const { resumeId, templateId } = req.body || {};
        
        // Determine which resume to use
        let selectedResume = null;
        if (resumeId) {
            selectedResume = resumes.find(r => r.id === resumeId);
        } else if (email.resumeIds && email.resumeIds.length > 0) {
            // Use resume attached to email
            selectedResume = resumes.find(r => r.id === email.resumeIds[0]);
        } else {
            // Use default resume
            selectedResume = resumes.find(r => r.isDefault);
        }
        
        // Determine which template to use
        let selectedTemplate = null;
        if (templateId) {
            selectedTemplate = templates.find(t => t.id === templateId);
        } else {
            // Use default template
            selectedTemplate = templates.find(t => t.isDefault) || templates[0];
        }
        
        // Get email content from selected template
        let emailContent, emailSubject;
        if (selectedTemplate) {
            emailContent = selectedTemplate.content
                .replace(/{{HR_NAME}}/g, email.hrName)
                .replace(/{{COMPANY_NAME}}/g, email.company);
            emailSubject = selectedTemplate.subject
                .replace(/{{HR_NAME}}/g, email.hrName)
                .replace(/{{COMPANY_NAME}}/g, email.company);
        } else {
            // Fallback to file-based template
            const template = loadTemplate();
            emailContent = populateTemplate(template, email.hrName, email.company);
            emailSubject = emailConfig.subject || `Application for position at ${email.company}`;
        }
        
        // Send email
        const mailOptions = {
            from: emailConfig.email,
            to: email.hrEmail,
            subject: emailSubject,
            html: emailContent.replace(/\n/g, '<br>'),
            attachments: []
        };
        
        // Add resume attachment if available
        if (selectedResume && fs.existsSync(selectedResume.filepath)) {
            mailOptions.attachments.push({
                filename: selectedResume.filename,
                path: selectedResume.filepath
            });
        }
        
        await transporter.sendMail(mailOptions);
        
        // Update status to sent
        email.status = 'sent';
        email.sentAt = new Date().toISOString();
        
        saveEmailsToFile();
        res.json({ success: true, email });
    } catch (error) {
        email.status = 'failed';
        saveEmailsToFile();
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email: ' + error.message });
    }
});

// Delete email
app.delete('/api/emails/:id', (req, res) => {
    const emailId = parseInt(req.params.id);
    const index = emails.findIndex(e => e.id === emailId);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Email not found' });
    }
    
    emails.splice(index, 1);
    saveEmailsToFile();
    res.json({ success: true });
});

// Update email status
app.patch('/api/emails/:id/status', (req, res) => {
    const emailId = parseInt(req.params.id);
    const { status } = req.body;
    const email = emails.find(e => e.id === emailId);
    
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }
    
    email.status = status;
    saveEmailsToFile();
    res.json(email);
});

// Templates endpoints
app.get('/api/templates', (req, res) => {
    res.json(templates);
});

app.post('/api/templates', (req, res) => {
    const { name, subject, content, isDefault } = req.body;
    
    if (!name || !subject || !content) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // If setting as default, remove default from all others
    if (isDefault) {
        templates.forEach(t => t.isDefault = false);
    }
    
    const newTemplate = {
        id: templateIdCounter++,
        name,
        subject,
        content,
        isDefault: isDefault || false
    };
    
    templates.push(newTemplate);
    saveTemplatesToFile();
    res.json(newTemplate);
});

app.put('/api/templates/:id', (req, res) => {
    const templateId = parseInt(req.params.id);
    const { name, subject, content, isDefault } = req.body;
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
        return res.status(404).json({ error: 'Template not found' });
    }
    
    // If setting as default, remove default from all others
    if (isDefault) {
        templates.forEach(t => t.isDefault = false);
    }
    
    if (name) template.name = name;
    if (subject) template.subject = subject;
    if (content) template.content = content;
    if (isDefault !== undefined) template.isDefault = isDefault;
    
    saveTemplatesToFile();
    res.json(template);
});

app.delete('/api/templates/:id', (req, res) => {
    const templateId = parseInt(req.params.id);
    const index = templates.findIndex(t => t.id === templateId);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Template not found' });
    }
    
    const deletedTemplate = templates[index];
    templates.splice(index, 1);
    
    // If deleted template was default and there are other templates, make first one default
    if (deletedTemplate.isDefault && templates.length > 0) {
        templates[0].isDefault = true;
    }
    
    saveTemplatesToFile();
    res.json({ success: true });
});

// Resume endpoints
app.get('/api/resumes', (req, res) => {
    res.json(resumes);
});

app.post('/api/resumes', upload.single('resume'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const name = req.body.name || req.file.originalname;
    
    const newResume = {
        id: resumeIdCounter++,
        name: name,
        filename: req.file.filename,
        filepath: req.file.path,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
        isDefault: resumes.length === 0 // First resume is default
    };
    
    resumes.push(newResume);
    saveResumesToFile();
    res.json(newResume);
});

app.patch('/api/resumes/:id/default', (req, res) => {
    const resumeId = parseInt(req.params.id);
    const resume = resumes.find(r => r.id === resumeId);
    
    if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
    }
    
    // Remove default from all resumes
    resumes.forEach(r => r.isDefault = false);
    // Set this resume as default
    resume.isDefault = true;
    
    saveResumesToFile();
    res.json(resume);
});

app.delete('/api/resumes/:id', (req, res) => {
    const resumeId = parseInt(req.params.id);
    const index = resumes.findIndex(r => r.id === resumeId);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Resume not found' });
    }
    
    const resume = resumes[index];
    
    // Delete the file
    if (fs.existsSync(resume.filepath)) {
        fs.unlinkSync(resume.filepath);
    }
    
    resumes.splice(index, 1);
    
    // If deleted resume was default and there are other resumes, make the first one default
    if (resume.isDefault && resumes.length > 0) {
        resumes[0].isDefault = true;
    }
    
    saveResumesToFile();
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open your browser and navigate to http://localhost:${PORT}`);
});
