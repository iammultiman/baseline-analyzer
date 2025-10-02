# Video Tutorial Scripts

## Table of Contents
1. [Getting Started - First Repository Analysis](#tutorial-1-getting-started)
2. [Organization Setup and Team Management](#tutorial-2-organization-setup)
3. [Credit Management and Purchasing](#tutorial-3-credit-management)
4. [Understanding Analysis Results](#tutorial-4-analysis-results)
5. [PWA Installation and Offline Features](#tutorial-5-pwa-features)
6. [Admin Configuration Walkthrough](#tutorial-6-admin-configuration)
7. [CI/CD Integration Setup](#tutorial-7-cicd-integration)

---

## Tutorial 1: Getting Started - First Repository Analysis
**Duration: 5-7 minutes**

### Script

**[INTRO - 0:00-0:30]**
"Welcome to Baseline Analyzer! I'm going to show you how to get started with your first repository analysis in just a few minutes. By the end of this tutorial, you'll have analyzed your first repository and understand how to interpret the results."

**[ACCOUNT CREATION - 0:30-1:30]**
"First, let's create your account. Navigate to the Baseline Analyzer homepage and click 'Sign Up'. You can either use your email and create a password, or sign up with Google for faster access. I'll use Google OAuth for this demo."

*[Screen: Show homepage, click Sign Up, demonstrate Google OAuth]*

"Great! Once you're signed up, you'll be redirected to your dashboard. Notice you start with 100 free credits - that's enough for several repository analyses to get you started."

**[FIRST ANALYSIS - 1:30-3:30]**
"Now let's analyze your first repository. Click 'Analyze Repository' from your dashboard. For this demo, I'll analyze the popular TypeScript repository from Microsoft."

*[Screen: Click Analyze Repository button, show form]*

"Paste your repository URL here. The system supports GitHub, GitLab, and other popular Git hosting services. Make sure the repository is public, or you'll need to provide authentication credentials."

*[Screen: Paste https://github.com/microsoft/TypeScript]*

"Before submitting, you can click 'Estimate Cost' to see how many credits this analysis will consume. This helps you manage your credit usage effectively."

*[Screen: Click Estimate Cost, show result]*

"The estimate shows this will cost about 15 credits. That's reasonable for a repository of this size. Now let's submit the analysis."

*[Screen: Click Submit Analysis]*

**[MONITORING PROGRESS - 3:30-4:30]**
"Once submitted, you'll see a real-time progress indicator. The system is now fetching your repository, processing the code, and running it through our AI analysis engine."

*[Screen: Show progress bar and status updates]*

"This typically takes 2-5 minutes depending on repository size. You can navigate away and come back - you'll receive a notification when it's complete."

**[VIEWING RESULTS - 4:30-6:30]**
"Excellent! Our analysis is complete. Let's explore the results. You can see the overall compliance score at the top - this repository scored 87%, which is quite good!"

*[Screen: Show results dashboard with compliance score]*

"Below that, you'll find detailed recommendations organized by priority. High-priority items are things you should address first for better web platform compatibility."

*[Screen: Scroll through recommendations]*

"The baseline matches section shows which web platform features your code uses and their compatibility status. This helps you understand what's working well and what might need attention."

*[Screen: Show baseline matches section]*

**[WRAP UP - 6:30-7:00]**
"And that's it! You've successfully analyzed your first repository. In our next tutorial, we'll cover how to set up organizations and invite team members. Thanks for watching!"

---

## Tutorial 2: Organization Setup and Team Management
**Duration: 6-8 minutes**

### Script

**[INTRO - 0:00-0:30]**
"In this tutorial, I'll show you how to set up an organization in Baseline Analyzer and invite team members. Organizations are perfect for teams who want to collaborate on repository analyses and share credits."

**[CREATING ORGANIZATION - 0:30-2:00]**
"From your dashboard, click 'Create Organization'. You'll need to provide an organization name and a unique slug. The slug will be used in URLs, so choose something memorable and professional."

*[Screen: Show organization creation form]*

"I'll create an organization called 'Acme Development Team' with the slug 'acme-dev'. You can also add a description and set initial preferences here."

*[Screen: Fill out form and submit]*

"Perfect! Your organization is now created. You'll notice your dashboard has changed to show organization-level information instead of just your personal account."

**[INVITING TEAM MEMBERS - 2:00-4:00]**
"Now let's invite some team members. Click 'Manage Team' to access the team management interface."

*[Screen: Navigate to team management]*

"To invite someone, click 'Invite Member' and enter their email address. You'll need to choose their role - let me explain the different roles:"

*[Screen: Show invitation form with role dropdown]*

"Owners have full access including billing and organization settings. Admins can manage team members and analyses but can't change billing. Members can submit analyses and view results. Viewers can only view existing analyses."

*[Screen: Demonstrate selecting different roles]*

"I'll invite a team member with the 'Member' role. Once you click 'Send Invitation', they'll receive an email with a secure link to join your organization."

*[Screen: Send invitation, show success message]*

**[MANAGING INVITATIONS - 4:00-5:30]**
"You can track pending invitations in the 'Pending Invitations' section. If someone hasn't responded, you can resend the invitation or cancel it if needed."

*[Screen: Show pending invitations list]*

"When team members accept invitations, they'll appear in your 'Active Members' list. From here, you can change their roles or remove them from the organization if needed."

*[Screen: Show active members management]*

**[ORGANIZATION SETTINGS - 5:30-7:00]**
"Let's look at organization settings. Here you can configure shared preferences like default AI providers, notification settings, and credit sharing policies."

*[Screen: Navigate through organization settings]*

"The usage analytics show how your team is using credits and which repositories are being analyzed most frequently. This helps with planning and budget management."

**[WRAP UP - 7:00-7:30]**
"That's how you set up and manage organizations in Baseline Analyzer. In the next tutorial, we'll cover credit management and purchasing. Thanks for watching!"

---

## Tutorial 3: Credit Management and Purchasing
**Duration: 5-6 minutes**

### Script

**[INTRO - 0:00-0:30]**
"In this tutorial, I'll walk you through the credit system in Baseline Analyzer - how credits work, how to purchase them, and how to monitor your usage effectively."

**[UNDERSTANDING CREDITS - 0:30-1:30]**
"Credits are the currency used for repository analyses. Different analyses cost different amounts based on repository size and complexity. Let's look at how this works."

*[Screen: Navigate to Credits page]*

"Your current balance is shown at the top. Below that, you can see your usage history - when you used credits, for which analyses, and how much each cost."

*[Screen: Show credit balance and usage history]*

"The cost calculator helps you estimate how much an analysis will cost before you run it. Larger repositories with more files typically cost more credits."

**[PURCHASING CREDITS - 1:30-3:30]**
"When you need more credits, click 'Purchase Credits' to see available packages. We offer several packages designed for different usage levels."

*[Screen: Show credit packages]*

"The Starter pack is perfect for individual developers, while the Business and Enterprise packages offer better value for teams. I'll purchase the Professional package for this demo."

*[Screen: Select Professional package]*

"Click 'Purchase' to proceed to payment. We use Stripe for secure payment processing, so your payment information is never stored on our servers."

*[Screen: Show payment form]*

"Enter your payment details and click 'Complete Purchase'. You'll see a confirmation screen, and your credits will be added to your account immediately."

*[Screen: Complete payment, show success]*

**[USAGE ANALYTICS - 3:30-4:30]**
"The Usage Analytics tab shows detailed information about how you're using credits over time. This chart shows your daily usage patterns."

*[Screen: Show usage analytics charts]*

"You can filter by date range to see weekly or monthly patterns. This helps you understand your usage and plan future credit purchases."

**[NOTIFICATIONS - 4:30-5:30]**
"Don't forget to set up low-credit notifications. Click 'Notification Settings' to configure when you want to be alerted about low credit balances."

*[Screen: Show notification settings]*

"I recommend setting this to at least 50 credits so you have time to purchase more before running out."

**[WRAP UP - 5:30-6:00]**
"That covers credit management in Baseline Analyzer. Next, we'll dive deep into understanding and acting on analysis results. Thanks for watching!"

---

## Tutorial 4: Understanding Analysis Results
**Duration: 8-10 minutes**

### Script

**[INTRO - 0:00-0:30]**
"In this tutorial, I'll help you understand and interpret the analysis results from Baseline Analyzer. We'll cover compliance scores, recommendations, and how to prioritize improvements."

**[COMPLIANCE SCORE OVERVIEW - 0:30-1:30]**
"Let's start with the compliance score. This number represents how well your repository aligns with current web platform baseline standards."

*[Screen: Show analysis results with compliance score]*

"Scores of 90-100% indicate excellent compliance. 70-89% is good with minor improvements needed. 50-69% suggests moderate compliance with several recommendations. Below 50% means significant improvements are recommended."

"This repository scored 87%, which is quite good, but let's see what improvements we can make."

**[UNDERSTANDING RECOMMENDATIONS - 1:30-4:00]**
"Recommendations are organized by priority. High-priority items should be addressed first as they have the biggest impact on compatibility and user experience."

*[Screen: Scroll through high-priority recommendations]*

"Each recommendation includes a description of the issue, why it matters, and specific steps to fix it. For example, this recommendation about using modern CSS features includes links to documentation and examples."

*[Screen: Click on a specific recommendation to expand details]*

"The 'Impact' section explains how fixing this issue will benefit your users. The 'Implementation' section provides code examples and best practices."

*[Screen: Show implementation details]*

"Medium and low-priority recommendations are also valuable but can be addressed after the high-priority items."

**[BASELINE MATCHES - 4:00-6:00]**
"The Baseline Matches section shows which web platform features your code currently uses and their compatibility status."

*[Screen: Navigate to baseline matches section]*

"Green items indicate features that are well-supported across browsers. Yellow items have limited support and might need polyfills. Red items are not yet baseline and should be used carefully."

*[Screen: Show different status indicators]*

"Click on any feature to see detailed browser support information and alternative approaches if needed."

*[Screen: Click on a feature to show details]*

**[TREND ANALYSIS - 6:00-7:30]**
"If you've analyzed this repository before, you'll see trend information showing how your compliance score has changed over time."

*[Screen: Show trend chart]*

"This helps you track improvements and see the impact of changes you've made based on previous recommendations."

**[EXPORTING RESULTS - 7:30-8:30]**
"You can export your results in several formats. The PDF export creates a professional report perfect for sharing with stakeholders."

*[Screen: Click export options, generate PDF]*

"The JSON export provides machine-readable data for integration with other tools, and the CSV export works well with spreadsheet applications."

**[TAKING ACTION - 8:30-9:30]**
"Now that you understand the results, here's how to prioritize your improvements:"

*[Screen: Show action plan]*

"1. Start with high-priority recommendations that affect user experience
2. Focus on features you're already using that need updates
3. Consider the effort required versus the benefit gained
4. Re-analyze after making changes to track your progress"

**[WRAP UP - 9:30-10:00]**
"That's how to interpret and act on your analysis results. In our next tutorial, we'll cover PWA installation and offline features. Thanks for watching!"

---

## Tutorial 5: PWA Installation and Offline Features
**Duration: 4-5 minutes**

### Script

**[INTRO - 0:00-0:30]**
"Baseline Analyzer is a Progressive Web App, which means you can install it like a native app and use many features offline. Let me show you how to install and use these features."

**[INSTALLING ON DESKTOP - 0:30-1:30]**
"On desktop browsers like Chrome or Edge, you'll see an install icon in the address bar when you visit Baseline Analyzer."

*[Screen: Show browser with install icon]*

"Click this icon and confirm the installation. The app will be added to your applications menu and can be launched like any other desktop application."

*[Screen: Demonstrate installation process]*

"Once installed, you'll notice the app opens in its own window without browser chrome, giving you a more focused experience."

**[INSTALLING ON MOBILE - 1:30-2:30]**
"On mobile devices, the installation process varies by platform. On iOS, open the app in Safari and tap the share button, then select 'Add to Home Screen'."

*[Screen: Show iOS installation process]*

"On Android, Chrome will show a banner prompting you to install the app, or you can use the browser menu to add it to your home screen."

*[Screen: Show Android installation process]*

**[OFFLINE FUNCTIONALITY - 2:30-3:30]**
"One of the key benefits of the PWA is offline functionality. Previously viewed analyses are cached and available even without an internet connection."

*[Screen: Demonstrate going offline, accessing cached content]*

"If you try to submit a new analysis while offline, the app will queue your request and process it automatically when you're back online."

*[Screen: Show offline queue functionality]*

"The offline indicator in the top bar shows your connection status and any queued actions."

**[APP UPDATES - 3:30-4:30]**
"When we release updates to Baseline Analyzer, you'll see a notification banner prompting you to update the app."

*[Screen: Show update notification]*

"Click 'Update' to get the latest features and improvements. The update happens seamlessly without losing any of your data."

**[WRAP UP - 4:30-5:00]**
"That's how to install and use Baseline Analyzer as a PWA. Next, we'll cover admin configuration for those managing their own deployment. Thanks for watching!"

---

## Tutorial 6: Admin Configuration Walkthrough
**Duration: 10-12 minutes**

### Script

**[INTRO - 0:00-0:30]**
"This tutorial is for administrators setting up and managing their own Baseline Analyzer deployment. I'll walk through the key configuration areas and best practices."

**[ACCESSING ADMIN PANEL - 0:30-1:00]**
"Access the admin panel by navigating to '/admin' with your administrator account. You'll see the main dashboard with system health indicators and key metrics."

*[Screen: Show admin dashboard]*

**[AI PROVIDER CONFIGURATION - 1:00-4:00]**
"Let's start with AI provider configuration. Click 'AI Providers' to manage your analysis engines."

*[Screen: Navigate to AI providers section]*

"Click 'Add Provider' to configure a new AI service. I'll set up OpenAI as our primary provider."

*[Screen: Show provider configuration form]*

"Enter your provider details: name, type, API key, and model preferences. The priority setting determines which provider is used first."

*[Screen: Fill out OpenAI configuration]*

"Always test the connection before saving. This verifies your API key is valid and the service is accessible."

*[Screen: Test connection, show success]*

"For redundancy, I recommend configuring at least two providers. If the primary fails, the system automatically switches to the backup."

*[Screen: Add second provider with lower priority]*

**[PRICING CONFIGURATION - 4:00-6:30]**
"Next, let's configure pricing. Navigate to the Pricing tab to set up your credit system."

*[Screen: Navigate to pricing configuration]*

"Set your base costs: cost per analysis, cost per file, and complexity multipliers. The markup percentage is your profit margin on top of AI provider costs."

*[Screen: Configure pricing parameters]*

"Create credit packages that make sense for your users. Consider offering volume discounts for larger packages."

*[Screen: Set up credit packages]*

"Don't forget to configure the free tier - how many credits new users receive and any usage limits."

*[Screen: Configure free tier settings]*

**[USER MANAGEMENT - 6:30-8:00]**
"The User Management section lets you oversee all user accounts. You can search, filter, and perform bulk operations."

*[Screen: Show user management interface]*

"Click on any user to view their details, credit balance, and usage history. You can adjust credits, disable accounts, or reset passwords as needed."

*[Screen: Show user details and available actions]*

"The bulk operations feature is useful for tasks like adding credits to multiple accounts or sending notifications."

**[SYSTEM MONITORING - 8:00-10:00]**
"System monitoring is crucial for maintaining service quality. The monitoring dashboard shows real-time system health."

*[Screen: Navigate to monitoring dashboard]*

"Key metrics include database performance, AI provider response times, and application resource usage. Set up alerts for critical thresholds."

*[Screen: Show various monitoring metrics]*

"The usage analytics help you understand system load patterns and plan for scaling."

*[Screen: Show usage analytics and trends]*

**[SECURITY SETTINGS - 10:00-11:00]**
"Security settings control access controls, rate limiting, and audit logging. Review these regularly to ensure your deployment is secure."

*[Screen: Show security configuration]*

"Enable audit logging to track all administrative actions. This is important for compliance and security investigations."

**[WRAP UP - 11:00-12:00]**
"That covers the essential admin configuration areas. Remember to regularly review your settings, monitor system health, and keep your AI provider configurations up to date. For detailed technical documentation, refer to the admin guide. Thanks for watching!"

---

## Tutorial 7: CI/CD Integration Setup
**Duration: 6-7 minutes**

### Script

**[INTRO - 0:00-0:30]**
"In this tutorial, I'll show you how to integrate Baseline Analyzer into your CI/CD pipeline for automated repository analysis. This is perfect for teams who want continuous monitoring of their code quality."

**[CREATING API KEYS - 0:30-1:30]**
"First, you'll need an API key for authentication. From your dashboard, navigate to the CI/CD Integration section."

*[Screen: Navigate to CI/CD integration]*

"Click 'Create API Key' and provide a name and description. This helps you manage multiple keys for different environments."

*[Screen: Create API key form]*

"Once created, copy the API key immediately - you won't be able to see it again for security reasons."

*[Screen: Show API key creation and copy]*

**[GITHUB ACTIONS INTEGRATION - 1:30-3:30]**
"Let's set up GitHub Actions integration. In your repository, create a workflow file at '.github/workflows/baseline-analysis.yml'."

*[Screen: Show file creation in GitHub]*

"Here's a basic workflow that runs analysis on every pull request:"

*[Screen: Show workflow YAML content]*

```yaml
name: Baseline Analysis
on:
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Baseline Analysis
        run: |
          curl -X POST https://your-analyzer.com/api/cicd/analyze \
            -H "Authorization: Bearer ${{ secrets.BASELINE_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "repositoryUrl": "${{ github.event.repository.clone_url }}",
              "branch": "${{ github.head_ref }}",
              "webhookUrl": "${{ github.event.pull_request.url }}"
            }'
```

"Don't forget to add your API key as a repository secret named 'BASELINE_API_KEY'."

*[Screen: Show adding secret in GitHub settings]*

**[WEBHOOK CONFIGURATION - 3:30-4:30]**
"For real-time updates, configure a webhook to receive analysis results. In your CI/CD settings, add a webhook URL."

*[Screen: Show webhook configuration]*

"When analysis completes, the webhook will receive a POST request with the results, allowing you to update pull request status or take other actions."

**[CLI TOOL USAGE - 4:30-5:30]**
"For more advanced integration, use our CLI tool. Install it in your build environment:"

*[Screen: Show CLI installation]*

```bash
npm install -g @baseline-analyzer/cli

# Configure with your API key
baseline-cli config set api-key YOUR_API_KEY

# Run analysis
baseline-cli analyze --repo https://github.com/your/repo --wait
```

"The CLI tool provides more options for customizing analysis and handling results."

**[INTERPRETING CI/CD RESULTS - 5:30-6:30]**
"CI/CD analysis results include machine-readable data perfect for automated decision-making. You can set quality gates based on compliance scores or specific recommendations."

*[Screen: Show example CI/CD results]*

"For example, you might fail the build if the compliance score drops below 80% or if high-priority security issues are detected."

**[WRAP UP - 6:30-7:00]**
"That's how to integrate Baseline Analyzer into your CI/CD pipeline. This enables continuous monitoring and helps maintain code quality automatically. Thanks for watching!"

---

## Production Notes

### Video Creation Guidelines

1. **Screen Recording**: Use high-resolution screen recording (1920x1080 minimum)
2. **Audio Quality**: Use a good microphone and record in a quiet environment
3. **Pacing**: Speak clearly and pause between major sections
4. **Visual Cues**: Use cursor highlighting and zoom for important UI elements
5. **Editing**: Add captions, intro/outro graphics, and smooth transitions

### Test Environment Setup

Before recording, ensure you have:
- A clean test environment with sample data
- Multiple test accounts with different roles
- Sample repositories for demonstration
- Working payment processing (test mode)
- All features properly configured

### Post-Production Checklist

- [ ] Add closed captions for accessibility
- [ ] Include chapter markers for easy navigation
- [ ] Add intro/outro with branding
- [ ] Optimize video for web delivery
- [ ] Create thumbnail images
- [ ] Upload to video hosting platform
- [ ] Update documentation with video links

These tutorial scripts provide comprehensive coverage of all major features and workflows in Baseline Analyzer. They can be used to create professional video tutorials that help users get the most out of the platform.