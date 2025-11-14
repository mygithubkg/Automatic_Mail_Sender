# Email Manager

A web-based email management system for sending templated emails to HR contacts.

## Features

- ✅ Add HR contacts with name, email, and company
- ✅ **Bulk import contacts from CSV or JSON files**
- ✅ View all emails in a queue with status tracking
- ✅ Send emails using customizable templates
- ✅ Track email status (pending → sending → sent)
- ✅ Send all pending emails at once
- ✅ Delete emails from the queue
- ✅ **Persistent storage - data survives server restarts**
- ✅ Beautiful, responsive UI with two-column layout (To Send / Sent)
- ✅ Real-time statistics dashboard

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Email Settings

Edit `config.json` with your Gmail credentials:

```json
{
  "email": "your-email@gmail.com",
  "password": "your-16-digit-app-password",
  "subject": "Application for Position"
}
```

**Important:** Use a Google App Password, not your regular Gmail password.

To create a Google App Password:
1. Go to your Google Account settings
2. Enable 2-Step Verification if not already enabled
3. Go to Security → 2-Step Verification → App passwords
4. Generate a new app password for "Mail"
5. Use this 16-digit password in config.json

### 3. Customize Email Template

Edit `email-template.html` to customize your email content. Use these placeholders:
- `{{HR_NAME}}` - Will be replaced with the HR person's name
- `{{COMPANY_NAME}}` - Will be replaced with the company name

### 4. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 5. Open the Web Interface

Open your browser and navigate to `http://localhost:3000`

## Usage

### Single Contact Entry
1. **Add an Email**: Fill in the form with HR name, email, and company name
2. **View Queue**: See all added emails in the table below
3. **Send Email**: Click the "Send" button to send the email
4. **Track Status**: Watch as the status changes from "pending" to "sending" to "sent"
5. **Delete**: Remove any email from the queue

### Bulk Import
1. **Prepare Your File**: Create a CSV or JSON file with your contacts
   - See `sample-contacts.csv` or `sample-contacts.json` for examples
2. **Click "Choose File"**: Select your CSV or JSON file
3. **Confirm Import**: Review the number of contacts and confirm
4. **Watch Progress**: Contacts are imported automatically

#### CSV Format
Your CSV file must have these columns: `hrName`, `hrEmail`, `company`

```csv
hrName,hrEmail,company
John Smith,john@company.com,Company Name
Jane Doe,jane@startup.com,Startup Inc
```

#### JSON Format
Your JSON file must be an array of contact objects:

```json
[
  {
    "hrName": "John Smith",
    "hrEmail": "john@company.com",
    "company": "Company Name"
  }
]
```

### Send All Emails
- Click the "📤 Send All Pending" button to send all pending emails at once
- Confirm the action in the dialog
- Watch as emails are sent with 1-second intervals

## Project Structure

```
Mailing/
├── server.js              # Express server with API endpoints
├── package.json           # Node.js dependencies
├── config.json           # Email configuration (credentials)
├── email-template.html   # Email template with placeholders
└── public/
    └── index.html        # Frontend web interface
```

## API Endpoints

- `GET /api/emails` - Get all emails
- `POST /api/emails` - Add a new email
- `POST /api/emails/:id/send` - Send a specific email
- `DELETE /api/emails/:id` - Delete an email
- `PATCH /api/emails/:id/status` - Update email status

## Notes

- Emails are stored in memory (will be lost on server restart)
- For production use, consider adding a database
- Make sure port 3000 is available
- Keep your config.json secure and never commit it to version control
