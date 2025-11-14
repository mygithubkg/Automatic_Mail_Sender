import requests
import json
import smtplib
import ssl
import time
from datetime import datetime


def generate_email(resume_content, company_content):
    """
    Generate a professional cold email using the local Ollama model.
    
    Args:
        resume_content (str): The content of the resume
        company_content (str): Information about the company
        
    Returns:
        str: The generated email text, or None if the API call fails
    """
    prompt_template = f"""You are a professional email writer. Write a professional cold email for a job application.

Resume Information:
{resume_content}

Company Information:
{company_content}

Instructions:
- Write a concise, professional cold email introducing the candidate to the company
- Connect the candidate's skills and experiences from the resume to the company's needs and culture
- Be specific and authentic
- Keep the email between 150-250 words
- Do not invent any skills or experiences not found in the resume
- Use a professional but friendly tone
- Include a clear call to action

Write only the email body without a subject line."""

    url = 'http://localhost:11434/api/generate'
    payload = {
        "model": "mistral",
        "prompt": prompt_template,
        "stream": False
    }
    
    try:
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            return result['response']
        else:
            print(f"Error: API returned status code {response.status_code}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("Error: Connection to Ollama failed. Please ensure Ollama is running.")
        return None
    except Exception as e:
        print(f"Error: An unexpected error occurred: {str(e)}")
        return None


def send_gmail(sender_email, app_password, recipient_email, subject, body):
    """
    Send an email using Gmail's SMTP server with SSL encryption.
    
    Args:
        sender_email (str): The sender's Gmail address
        app_password (str): The 16-digit Google App Password
        recipient_email (str): The recipient's email address
        subject (str): The email subject line
        body (str): The email body content
    """
    smtp_server = "smtp.gmail.com"
    port = 465
    
    message = f"""Subject: {subject}
From: {sender_email}
To: {recipient_email}

{body}"""
    
    context = ssl.create_default_context()
    
    try:
        with smtplib.SMTP_SSL(smtp_server, port, context=context) as server:
            server.login(sender_email, app_password)
            server.sendmail(sender_email, recipient_email, message)
            print("Email sent successfully!")
            
    except smtplib.SMTPAuthenticationError:
        print("Error: Authentication failed. Please check your 16-digit App Password or 'Less secure apps' settings.")


def wait_for_schedule(schedule_time_str):
    """
    Pause script execution until a specified date and time.
    
    Args:
        schedule_time_str (str): The scheduled time in format 'YYYY-MM-DD HH:MM:SS'
    """
    try:
        schedule_time = datetime.strptime(schedule_time_str, '%Y-%m-%d %H:%M:%S')
        now = datetime.now()
        wait_seconds = (schedule_time - now).total_seconds()
        
        if wait_seconds > 0:
            print(f"Waiting for scheduled time: {schedule_time_str}")
            time.sleep(wait_seconds)
            print("Time reached, proceeding...")
        else:
            print("Scheduled time is in the past. Proceeding immediately...")
            
    except ValueError:
        print("Error: Invalid time format. Please use 'YYYY-MM-DD HH:MM:SS'.")


if __name__ == "__main__":
    # Configuration - Replace these with your actual values
    SENDER_EMAIL = "your-email@gmail.com"
    APP_PASSWORD = "your-16-digit-app-password"
    RECIPIENT_EMAIL = "recipient@example.com"
    SUBJECT = "Application for [Position Name]"
    
    # Resume content
    RESUME_CONTENT = """
    [Your Name]
    [Your contact information]
    
    EXPERIENCE:
    - [Job Title] at [Company] (Years)
      • [Achievement or responsibility]
    
    SKILLS:
    - [Skill 1]
    - [Skill 2]
    
    EDUCATION:
    - [Degree] in [Field] from [University]
    """
    
    # Company information
    COMPANY_CONTENT = """
    Company Name: [Company Name]
    Industry: [Industry]
    About: [Brief description of the company and what they do]
    Position: [Position you're applying for]
    """
    
    # Optional: Schedule the email (format: 'YYYY-MM-DD HH:MM:SS')
    # Set to None to send immediately
    SCHEDULE_TIME = None  # Example: "2025-11-02 14:30:00"
    
    print("=== Email Generator Started ===")
    
    # Wait for scheduled time if specified
    if SCHEDULE_TIME:
        wait_for_schedule(SCHEDULE_TIME)
    
    # Generate email content
    print("\nGenerating email content...")
    email_body = generate_email(RESUME_CONTENT, COMPANY_CONTENT)
    
    if email_body:
        print("\n--- Generated Email ---")
        print(email_body)
        print("\n--- End of Email ---\n")
        
        # Send the email
        print("Sending email...")
        send_gmail(SENDER_EMAIL, APP_PASSWORD, RECIPIENT_EMAIL, SUBJECT, email_body)
    else:
        print("\nFailed to generate email. Please check if Ollama is running.")
    
    print("\n=== Process Complete ===")

