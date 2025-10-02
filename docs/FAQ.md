# Frequently Asked Questions (FAQ)

## Table of Contents
1. [General Questions](#general-questions)
2. [Account and Billing](#account-and-billing)
3. [Repository Analysis](#repository-analysis)
4. [Credit System](#credit-system)
5. [Organizations and Teams](#organizations-and-teams)
6. [Technical Issues](#technical-issues)
7. [Security and Privacy](#security-and-privacy)
8. [API and Integration](#api-and-integration)

---

## General Questions

### What is Baseline Analyzer?
Baseline Analyzer is a Progressive Web Application that uses AI to analyze code repositories against web platform baseline standards. It helps developers understand how well their code aligns with modern web standards and provides actionable recommendations for improvement.

### How does the analysis work?
The system fetches your repository code, processes it into an AI-readable format, and analyzes it against current web platform baseline data using advanced AI models. The analysis considers browser compatibility, modern web standards, and best practices to generate comprehensive recommendations.

### Which repositories can I analyze?
You can analyze:
- Public repositories from GitHub, GitLab, Bitbucket, and other Git hosting services
- Private repositories (with proper authentication)
- Repositories of any size, though larger repositories cost more credits
- Projects in any programming language, with focus on web technologies

### How accurate are the analysis results?
Our analysis is powered by state-of-the-art AI models and up-to-date web platform baseline data. While highly accurate, results should be considered recommendations rather than absolute requirements. We continuously improve our analysis engine based on user feedback and evolving web standards.

### Is there a free tier?
Yes! New users receive 100 free credits upon registration, which is enough for several repository analyses. We also provide monthly credit refills for active users within reasonable usage limits.

---

## Account and Billing

### How do I create an account?
Visit the Baseline Analyzer homepage and click "Sign Up". You can register with your email and password or use Google OAuth for faster access. Email verification is required for security.

### Can I change my email address?
Yes, you can update your email address in your profile settings. You'll need to verify the new email address before the change takes effect.

### How do I delete my account?
Contact our support team at support@baselineanalyzer.com to request account deletion. We'll permanently remove your data within 30 days, in compliance with data protection regulations.

### What payment methods do you accept?
We accept all major credit cards (Visa, MasterCard, American Express, Discover) and PayPal through our secure payment processor, Stripe. We don't store any payment information on our servers.

### Can I get a refund?
We offer refunds within 30 days of purchase if you're not satisfied with the service. Unused credits can be refunded at their original purchase price. Contact support for refund requests.

### Do you offer enterprise pricing?
Yes, we offer custom enterprise pricing for large organizations with high-volume usage. Contact our sales team for a personalized quote based on your needs.

---

## Repository Analysis

### How long does analysis take?
Analysis time varies based on repository size:
- Small repositories (< 100 files): 1-3 minutes
- Medium repositories (100-1000 files): 3-8 minutes
- Large repositories (> 1000 files): 8-15 minutes
- Very large repositories: Up to 30 minutes

### Why did my analysis fail?
Common reasons for analysis failure:
- Repository is private and requires authentication
- Repository URL is incorrect or repository doesn't exist
- Repository is too large (> 1GB)
- Insufficient credits in your account
- Temporary AI provider issues

Check the error message for specific details and solutions.

### Can I analyze private repositories?
Yes, but you'll need to provide authentication credentials. We support:
- Personal access tokens for GitHub/GitLab
- SSH keys for Git repositories
- OAuth authentication for supported platforms

Your credentials are encrypted and never stored permanently.

### What programming languages are supported?
While we can analyze repositories in any language, our recommendations are most comprehensive for:
- JavaScript/TypeScript
- HTML/CSS
- React, Vue, Angular frameworks
- Node.js applications
- Progressive Web Apps

We're continuously expanding support for additional languages and frameworks.

### Can I analyze specific branches or directories?
Currently, we analyze the default branch of the entire repository. Support for specific branches and directory filtering is planned for future releases.

### How often should I analyze my repository?
We recommend:
- After major feature releases
- Before important deployments
- Monthly for active projects
- After implementing previous recommendations

Regular analysis helps track improvements and catch new issues early.

---

## Credit System

### How do credits work?
Credits are consumed when you run repository analyses. The cost depends on:
- Repository size (number of files and total size)
- Code complexity
- Analysis depth and features used

You can estimate costs before running analysis.

### How much do analyses cost?
Typical costs:
- Small project (< 50 files): 5-15 credits
- Medium project (50-500 files): 15-50 credits
- Large project (500+ files): 50-150 credits
- Enterprise project: 150+ credits

Use the cost estimator for accurate pricing before analysis.

### Do credits expire?
Credits purchased through paid packages don't expire. Free credits may have expiration policies to prevent abuse. Check your account details for specific expiration dates.

### Can I share credits with my team?
Yes, organization accounts allow credit sharing among team members. The organization owner manages the credit pool and can set usage limits for team members.

### What happens if I run out of credits during analysis?
If you run out of credits after starting an analysis, the analysis will complete but you won't be able to start new analyses until you purchase more credits. We'll notify you before this happens.

### Can I get more free credits?
We occasionally offer promotional credits for:
- Referring new users
- Participating in beta testing
- Contributing to our community
- Educational use cases

Follow our social media or newsletter for announcements.

---

## Organizations and Teams

### What's the difference between personal and organization accounts?
Personal accounts are for individual developers, while organization accounts enable:
- Team collaboration
- Shared credit pools
- Role-based access control
- Centralized billing
- Organization-wide analytics

### How do I invite team members?
From your organization dashboard:
1. Click "Manage Team"
2. Click "Invite Member"
3. Enter their email and select a role
4. Click "Send Invitation"

They'll receive an email with instructions to join.

### What are the different team roles?
- **Owner**: Full access including billing and organization management
- **Admin**: Team management and configuration, no billing access
- **Member**: Can submit analyses and view organization results
- **Viewer**: Read-only access to analyses and reports

### Can team members have different credit limits?
Yes, organization owners and admins can set individual credit limits for team members to control usage and costs.

### How do I transfer ownership of an organization?
Contact support to transfer organization ownership. Both current and new owners must confirm the transfer for security reasons.

### Can I be part of multiple organizations?
Yes, you can be a member of multiple organizations. Switch between them using the organization selector in your dashboard.

---

## Technical Issues

### The website is loading slowly. What should I do?
Try these steps:
1. Check your internet connection
2. Clear your browser cache and cookies
3. Try a different browser or incognito mode
4. Disable browser extensions temporarily
5. Check our status page for known issues

If problems persist, contact support with your browser and system details.

### I'm getting authentication errors. How do I fix this?
Common solutions:
1. Log out and log back in
2. Clear browser cookies for our site
3. Try incognito/private browsing mode
4. Check if your account email is verified
5. Reset your password if needed

### The PWA isn't working offline. Why?
Ensure:
1. You've visited the pages you want to access offline while online
2. Your browser supports service workers
3. You haven't disabled JavaScript
4. The PWA is properly installed

Some features require an internet connection and won't work offline.

### I can't install the PWA. What's wrong?
PWA installation requirements:
- Modern browser (Chrome, Firefox, Safari, Edge)
- HTTPS connection (automatic on our platform)
- Valid web app manifest
- Service worker registration

Try refreshing the page or using a different browser.

### My analysis results look incorrect. What should I do?
If you believe results are inaccurate:
1. Check that you analyzed the correct repository and branch
2. Verify the repository contains the code you expected
3. Review the analysis methodology in our documentation
4. Contact support with specific examples of incorrect results

We continuously improve our analysis based on user feedback.

---

## Security and Privacy

### How do you protect my code?
We take code security seriously:
- All data transmission uses TLS 1.3 encryption
- Code is processed temporarily and not permanently stored
- Access is restricted to authorized analysis systems only
- We comply with SOC 2 and other security standards

### Do you store my repository code?
We temporarily cache repository content during analysis but don't permanently store your code. All temporary data is automatically deleted after analysis completion.

### Can other users see my analysis results?
No, analysis results are private to your account or organization. Only users with explicit access (team members in organizations) can view results.

### How do you handle authentication tokens?
Authentication tokens for private repositories are:
- Encrypted in transit and at rest
- Used only for repository access during analysis
- Automatically deleted after use
- Never logged or stored permanently

### Is my payment information secure?
We use Stripe for payment processing and never store payment information on our servers. All payment data is handled according to PCI DSS standards.

### Do you comply with GDPR?
Yes, we're fully GDPR compliant. You can:
- Request data export
- Request data deletion
- Opt out of marketing communications
- Control data processing preferences

Contact our privacy team for specific requests.

---

## API and Integration

### Do you offer an API?
Yes, we provide a REST API for:
- Submitting repository analyses
- Retrieving analysis results
- Managing credits and usage
- Webhook notifications

See our API documentation for details.

### How do I integrate with CI/CD pipelines?
We support integration with:
- GitHub Actions
- GitLab CI/CD
- Jenkins
- Azure DevOps
- CircleCI
- Any system that can make HTTP requests

Check our CI/CD integration guide for specific examples.

### Can I get webhook notifications?
Yes, you can configure webhooks to receive notifications when:
- Analysis completes
- Analysis fails
- Credit balance is low
- New team members join

### What's the API rate limit?
API rate limits depend on your plan:
- Free tier: 100 requests per hour
- Paid plans: 1000+ requests per hour
- Enterprise: Custom limits

Rate limits are per API key, not per user.

### Can I bulk analyze multiple repositories?
Yes, the API supports bulk analysis operations. You can submit multiple repositories in a single request or use our CLI tool for batch processing.

### Do you offer SDKs or client libraries?
We provide official SDKs for:
- JavaScript/Node.js
- Python
- Go
- CLI tool

Community-maintained SDKs are available for other languages.

---

## Still Have Questions?

If you can't find the answer to your question here, we're here to help:

- **Email Support**: support@baselineanalyzer.com
- **Live Chat**: Available during business hours (9 AM - 5 PM EST)
- **Community Forum**: Join discussions with other users
- **Documentation**: Comprehensive guides and tutorials
- **Status Page**: Check for known issues and maintenance

**Response Times:**
- General inquiries: 24-48 hours
- Technical issues: 12-24 hours
- Billing questions: 4-8 hours
- Critical issues: 2-4 hours

We're committed to providing excellent support and helping you get the most out of Baseline Analyzer!