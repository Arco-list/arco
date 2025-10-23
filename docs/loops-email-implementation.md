# Loops.so Email Integration Implementation Guide

## Overview
Complete implementation guide for replacing Supabase's default email system with Loops.so transactional emails using a minimal, scalable approach.

## Decision: Direct API vs Next.js SDK

**Why we chose Direct API over the Loops Next.js SDK:**

1. **Zero Dependencies**: No need to install the `loops` package
2. **Minimal Bundle Size**: Direct fetch adds zero bytes vs SDK package overhead
3. **Full Control**: Complete control over request/response handling and error management
4. **Simplicity**: Single fetch call vs SDK initialization and abstraction
5. **Transparency**: Clear understanding of what's happening under the hood
6. **Alignment**: Meets requirement for "as less code as possible"

The SDK essentially wraps the same fetch call we'll implement, adding unnecessary complexity for our use case.

## Implementation

⚠️ **CRITICAL SECURITY REQUIREMENT**: This email service MUST ONLY be used on the server-side. Never call these functions from client-side code as it would expose your Loops API key.

### 1. Email Service Implementation

Create `lib/email-service.ts` (SERVER-SIDE ONLY):

## Step-by-Step Code Explanation

Before diving into the full implementation, let's understand exactly what happens when we send an email through Loops.so, line by line:

### Basic Email Sending Process

```typescript
// Step 1: Prepare the data we want to send to Loops
const data = {
  email: "user@gmail.com",                    // Who gets the email
  transactionalId: "welcome_template_123",    // Which email template to use
  dataVariables: {                           // Variables to fill in the template
    firstname: "John",                       // {firstname} in template becomes "John"
    company_name: "Acme Corp"               // {company_name} in template becomes "Acme Corp"
  }
};

// Step 2: Send this data to Loops.so servers using fetch (like making a web request)
const response = await fetch("https://app.loops.so/api/v1/transactional", {
  method: "POST",                           // We're sending data (POST request)
  headers: {                               // Information about our request
    "Content-Type": "application/json",    // We're sending JSON data
    Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, // Our secret key to prove we own this account
  },
  body: JSON.stringify(data),              // Convert our data object to JSON text
});

// Step 3: Get the response from Loops and convert it back to JavaScript object
const result = await response.json();

// Step 4: Check if it worked
if (result.success) {
  console.log("Email sent successfully!");
} else {
  console.log("Email failed to send:", result.message);
}
```

### Why This Must Run on the Server

```typescript
// ❌ DANGER: If this ran in the browser...
Authorization: `Bearer ${process.env.LOOPS_API_KEY}`

// The browser would need access to LOOPS_API_KEY
// This would expose your secret key to anyone who visits your website
// They could then send emails from your account, read your data, etc.

// ✅ SAFE: When this runs on the server...
// Only your server knows the LOOPS_API_KEY
// The browser never sees it
// Users can trigger emails, but can't access your account directly
```

### How Next.js Server Actions Work

```typescript
// File: app/actions.ts
'use server';  // ← This magic comment tells Next.js "run this on the server"

export async function sendWelcomeEmail(userEmail: string, userName: string) {
  // Everything in this function runs on YOUR SERVER, not the user's browser
  
  // Step 1: Prepare email data
  const emailData = {
    email: userEmail,           // Use the email passed to this function
    transactionalId: "welcome", // Use our welcome email template
    dataVariables: {
      firstname: userName       // Fill in the {firstname} variable
    }
  };
  
  // Step 2: Send to Loops (this happens on your server)
  const response = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, // Server has access to this
    },
    body: JSON.stringify(emailData),
  });
  
  // Step 3: Handle the response
  const result = await response.json();
  return result; // Send result back to whoever called this function
}
```

### How to Use Server Actions from the Frontend

```typescript
// File: components/signup-form.tsx
'use client'; // This runs in the browser

import { sendWelcomeEmail } from '@/app/actions';

export function SignupForm() {
  const handleSubmit = async (formData: FormData) => {
    // Get form data
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    
    // Call our server action
    // Even though this looks like a normal function call,
    // Next.js actually sends this to your server behind the scenes
    const result = await sendWelcomeEmail(email, name);
    
    if (result.success) {
      alert("Welcome email sent!");
    } else {
      alert("Failed to send email");
    }
  };

  return (
    <form action={handleSubmit}>
      <input name="email" type="email" placeholder="Email" />
      <input name="name" placeholder="Name" />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### What Happens When User Clicks "Sign Up"

1. **User fills form and clicks submit** (happens in browser)
2. **Form data gets sent to your server** (Next.js handles this)
3. **`sendWelcomeEmail` function runs on your server** (not in browser)
4. **Your server calls Loops.so API** (using your secret key)
5. **Loops.so sends the email** (to the user's email address)
6. **Your server gets response from Loops** (success or failure)
7. **Response gets sent back to user's browser** (Next.js handles this)
8. **Browser shows success/error message** (user sees result)

Now let's look at the complete implementation:

```typescript
// Email template types based on current email specifications
export type EmailTemplate = 
  | 'homeowner-welcome'
  | 'professional-welcome'
  | 'project-review'
  | 'project-live'
  | 'project-rejected'
  | 'company-live'
  | 'project-invitation';

export interface EmailVariables {
  // User variables
  firstname?: string;
  
  // Company variables
  company_name?: string;
  company_title?: string;
  company_image?: string;
  company_link?: string;
  
  // Project variables
  project_name?: string;
  project_title?: string;
  project_image?: string;
  project_link?: string;
  
  // Professional variables
  professional_inviter?: string;
  
  // Action variables
  dashboard_link?: string;
  rejection_reason?: string;
  
  // Future extensibility - allows any additional variables
  [key: string]: any;
}

// Template ID mapping - Update these IDs from your Loops dashboard
const EMAIL_TEMPLATES: Record<EmailTemplate, string> = {
  'homeowner-welcome': 'homeowner_welcome_template_id',
  'professional-welcome': 'professional_welcome_template_id',
  'project-review': 'project_review_template_id',
  'project-live': 'project_live_template_id',
  'project-rejected': 'project_rejected_template_id',
  'company-live': 'company_live_template_id',
  'project-invitation': 'project_invitation_template_id'
};

interface LoopsResponse {
  success: boolean;
  message?: string;
}

/**
 * Send a transactional email via Loops.so
 * @param email - Recipient email address
 * @param template - Email template type
 * @param dataVariables - Variables to populate in the email template
 * @returns Promise with success status and optional message
 */
export async function sendTransactionalEmail(
  email: string,
  template: EmailTemplate,
  dataVariables?: EmailVariables
): Promise<LoopsResponse> {
  const apiKey = process.env.LOOPS_API_KEY;
  
  if (!apiKey) {
    console.error('LOOPS_API_KEY environment variable is required');
    return { success: false, message: 'Email service not configured' };
  }

  const transactionalId = EMAIL_TEMPLATES[template];
  
  if (!transactionalId) {
    console.error(`Template ${template} not found in EMAIL_TEMPLATES`);
    return { success: false, message: `Template ${template} not configured` };
  }

  try {
    const response = await fetch('https://app.loops.so/api/v1/transactional', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        transactionalId,
        dataVariables: dataVariables || {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Loops API error:', response.status, errorText);
      return { success: false, message: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json() as LoopsResponse;
    
    if (!result.success) {
      console.error('Loops email sending failed:', result.message);
      return { success: false, message: result.message || 'Email sending failed' };
    }

    console.log(`Email sent successfully: ${template} to ${email}`);
    return result;
  } catch (error) {
    console.error('Email service network error:', error);
    return { success: false, message: 'Network error sending email' };
  }
}

// Convenience functions for common email scenarios

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (
  email: string, 
  firstname: string, 
  userType: 'homeowner' | 'professional', 
  companyName?: string
): Promise<LoopsResponse> => {
  if (userType === 'homeowner') {
    return sendTransactionalEmail(email, 'homeowner-welcome', { firstname });
  } else {
    return sendTransactionalEmail(email, 'professional-welcome', { 
      firstname, 
      company_name: companyName 
    });
  }
};

/**
 * Send project status update emails
 */
export const sendProjectStatusEmail = async (
  email: string, 
  status: 'review' | 'live' | 'rejected',
  projectData: {
    project_name: string;
    project_title: string;
    project_image?: string;
    dashboard_link: string;
    project_link?: string;
    rejection_reason?: string;
  }
): Promise<LoopsResponse> => {
  const templateMap = {
    review: 'project-review' as const,
    live: 'project-live' as const,
    rejected: 'project-rejected' as const
  };
  
  return sendTransactionalEmail(email, templateMap[status], projectData);
};

/**
 * Send company status email
 */
export const sendCompanyLiveEmail = async (
  email: string,
  companyData: {
    company_name: string;
    company_title: string;
    company_image?: string;
    company_link: string;
  }
): Promise<LoopsResponse> => {
  return sendTransactionalEmail(email, 'company-live', companyData);
};

/**
 * Send project invitation email
 */
export const sendProjectInvitationEmail = async (
  email: string,
  invitationData: {
    professional_inviter: string;
    project_name: string;
    project_title: string;
    dashboard_link: string;
  }
): Promise<LoopsResponse> => {
  return sendTransactionalEmail(email, 'project-invitation', invitationData);
};
```

### 2. Environment Configuration

Update `.env.example`:

```bash
# Existing Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PRIVACY_EMAIL=your-privacy-email@example.com
NEXT_PUBLIC_LEGAL_EMAIL=your-legal-email@example.com

# Loops.so Email Configuration
LOOPS_API_KEY=your-loops-api-key-here

# Other Configuration
NODE_ENV=development
```

Add to your actual `.env.local`:
```bash
LOOPS_API_KEY=your_actual_loops_api_key_from_dashboard
```

### 3. Loops Dashboard Template Configuration

Create the following transactional email templates in your Loops dashboard with these exact variable mappings:

#### Homeowner Welcome
- **Template Name**: Homeowner Welcome
- **Subject**: "Welcome to Arco!"
- **Variables**: `{firstname}`
- **Content**: "Hi {firstname}, welcome to Arco! We're excited to help you discover inspiring projects and connect with talented professionals for your home renovation."

#### Professional Welcome  
- **Template Name**: Professional Welcome
- **Subject**: "Start building your portfolio"
- **Variables**: `{firstname}`, `{company_name}`
- **Content**: "Hi {firstname}, welcome to Arco! Start building your portfolio on our platform and connect with homeowners looking for professionals like you at {company_name}."

#### Project Review
- **Template Name**: Project Review
- **Subject**: "{project_name} is submitted successfully"
- **Variables**: `{project_name}`, `{project_title}`, `{project_image}`, `{dashboard_link}`
- **Content**: "Thank you for submitting! We'll review your project ensure and notify you as soon as your project goes live on our platform."

#### Project Live
- **Template Name**: Project Live
- **Subject**: "{project_name} is now live!"
- **Variables**: `{project_name}`, `{project_title}`, `{project_image}`, `{project_link}`
- **Content**: "Great news! We've reviewed your project and it is now live to be discovered by homeowners on Arco."

#### Project Rejected
- **Template Name**: Project Rejected
- **Subject**: "{project_name} needs adjustments"
- **Variables**: `{project_name}`, `{project_title}`, `{project_image}`, `{rejection_reason}`, `{dashboard_link}`
- **Content**: "We've reviewed your project and it needs a few adjustments before we can put it live: {rejection_reason}. Please update your project and resubmit it."

#### Company Live
- **Template Name**: Company Live
- **Subject**: "{company_name} is now visible on Arco"
- **Variables**: `{company_name}`, `{company_title}`, `{company_image}`, `{company_link}`
- **Content**: "Congratulations! Your company page is now live on Arco. Homeowners can now discover your work and get in touch."

#### Project Invitation
- **Template Name**: Project Invitation
- **Subject**: "{professional_inviter} invited you to a project"
- **Variables**: `{professional_inviter}`, `{project_name}`, `{project_title}`, `{dashboard_link}`
- **Content**: "{professional_inviter} has invited you to collaborate on {project_name}. Accept the invitation to be visible on the project page and add the project to your portfolio."

**Important**: After creating each template, copy the template ID from Loops and update the `EMAIL_TEMPLATES` constant in `lib/email-service.ts`.

## Server-Side Integration Examples

⚠️ **SECURITY NOTE**: All examples below MUST be implemented server-side only (API routes, Server Actions, or server components).

### 1. User Registration Flow (Server Action)

```typescript
// app/(auth)/actions.ts - Server Action
'use server';

import { sendWelcomeEmail } from '@/lib/email-service';

export async function handleUserSignup(userData: {
  email: string;
  firstname: string;
  userType: 'homeowner' | 'professional';
  companyName?: string;
}) {
  // ... existing signup logic
  
  const emailResult = await sendWelcomeEmail(
    userData.email,
    userData.firstname,
    userData.userType,
    userData.companyName
  );
  
  if (!emailResult.success) {
    console.error('Failed to send welcome email:', emailResult.message);
    // Decide if this should block signup or just log the error
  }
}
```

### 1b. Alternative: API Route Approach

```typescript
// app/api/send-welcome-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const { email, firstname, userType, companyName } = await request.json();
    
    const result = await sendWelcomeEmail(email, firstname, userType, companyName);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('API error sending welcome email:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Client-side usage (safe)
const response = await fetch('/api/send-welcome-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, firstname, userType, companyName })
});
const result = await response.json();
```

### 2. Project Workflow Integration (Server Actions)

```typescript
// app/admin/projects/actions.ts - Server Actions
'use server';

import { sendProjectStatusEmail } from '@/lib/email-service';

export async function handleProjectSubmission(projectData: any, userEmail: string) {
  // ... existing project creation logic
  
  const emailResult = await sendProjectStatusEmail(userEmail, 'review', {
    project_name: projectData.name,
    project_title: projectData.title,
    project_image: projectData.images?.[0],
    dashboard_link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/projects/${projectData.id}`
  });
  
  if (!emailResult.success) {
    console.error('Failed to send project review email:', emailResult.message);
  }
}

// In your admin approval handler (Server Action)
export async function handleProjectApproval(projectId: string, approved: boolean) {
  const project = await getProject(projectId);
  const user = await getProjectOwner(projectId);
  
  if (approved) {
    await sendProjectStatusEmail(user.email, 'live', {
      project_name: project.name,
      project_title: project.title,
      project_image: project.images?.[0],
      project_link: `${process.env.NEXT_PUBLIC_SITE_URL}/projects/${project.slug}`
    });
  } else {
    await sendProjectStatusEmail(user.email, 'rejected', {
      project_name: project.name,
      project_title: project.title,
      project_image: project.images?.[0],
      dashboard_link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/projects/${project.id}`,
      rejection_reason: project.rejection_reason
    });
  }
}
```

### 2b. Alternative: API Routes for Project Emails

```typescript
// app/api/send-project-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendProjectStatusEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const { email, status, projectData } = await request.json();
    
    const result = await sendProjectStatusEmail(email, status, projectData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('API error sending project email:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 3. Professional Invitation System (Server Action)

```typescript
// app/projects/[slug]/actions.ts - Server Action
'use server';

import { sendProjectInvitationEmail } from '@/lib/email-service';

export async function inviteProfessionalToProject(
  inviterEmail: string,
  inviteeEmail: string,
  projectData: any
) {
  const inviter = await getUserByEmail(inviterEmail);
  
  const emailResult = await sendProjectInvitationEmail(inviteeEmail, {
    professional_inviter: inviter.firstname,
    project_name: projectData.name,
    project_title: projectData.title,
    dashboard_link: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/invitations`
  });
  
  return emailResult;
}
```

## Migration from Supabase Default Emails

### Option 1: Complete Replacement
1. Replace all existing email triggers with Loops service calls
2. Disable Supabase's default email sending
3. Handle all transactional emails through Loops

### Option 2: Hybrid Approach
1. Use Loops for business emails (welcome, project updates, etc.)
2. Keep Supabase for critical auth emails (password reset, email verification)
3. Configure Loops SMTP in Supabase as backup

### Supabase SMTP Configuration (Optional)
If you want to use Loops SMTP in Supabase:

1. Go to Authentication settings in Supabase dashboard
2. Enable custom SMTP with these settings:
   - **Host**: `smtp.loops.so`
   - **Port**: `587`
   - **Username**: Your Loops SMTP username
   - **Password**: Your Loops SMTP password
   - **Sender**: `no-reply@yourdomain.com`

## Implementation Checklist

### Phase 1: Setup
- [ ] Create Loops.so account and get API key
- [ ] Add `LOOPS_API_KEY` to environment variables
- [ ] Create `lib/email-service.ts` file
- [ ] Set up all 7 email templates in Loops dashboard
- [ ] Update template IDs in `EMAIL_TEMPLATES` constant

### Phase 2: Integration
- [ ] Replace welcome email in signup flow
- [ ] Replace project submission notifications
- [ ] Replace admin approval/rejection emails
- [ ] Replace company approval emails
- [ ] Replace professional invitation emails

### Phase 3: Testing
- [ ] Test all email templates with real data
- [ ] Verify variable substitution works correctly
- [ ] Test error handling scenarios
- [ ] Verify email deliverability

### Phase 4: Monitoring
- [ ] Set up logging for email sending results
- [ ] Monitor Loops dashboard for delivery metrics
- [ ] Set up alerts for failed email sends

## Error Handling Strategy

```typescript
// Example of proper error handling in your application
const emailResult = await sendTransactionalEmail(email, template, variables);

if (!emailResult.success) {
  // Log the error for monitoring
  console.error(`Email failed: ${template} to ${email}`, emailResult.message);
  
  // Decide on fallback strategy:
  // 1. Retry once after delay
  // 2. Queue for later processing
  // 3. Send notification to admin
  // 4. Continue without blocking user flow
}
```

## Future Extensibility

### Adding New Email Templates
1. Add new template type to `EmailTemplate` union
2. Add template ID to `EMAIL_TEMPLATES` constant
3. Create template in Loops dashboard
4. Add convenience function if needed

### Adding New Variables
1. Add variables to `EmailVariables` interface
2. Update existing templates in Loops dashboard if needed
3. No code changes required thanks to `[key: string]: any`

## Benefits

- **Minimal Code**: ~150 lines handles all email scenarios
- **Type Safety**: Full TypeScript support prevents errors
- **Easy Maintenance**: Template content managed in Loops dashboard
- **Scalable**: Easy to add new templates without code changes
- **Performance**: Direct API calls, no SDK overhead
- **Error Handling**: Comprehensive error responses and logging
- **Future-Proof**: Variable system supports any new fields

## Security & Server-Side Implementation

### Critical Security Requirements

⚠️ **NEVER expose the Loops API key in client-side code**

The email service MUST only be called from:
- **Server Actions** (`'use server'` directive)
- **API Routes** (`app/api/*/route.ts`)
- **Server Components** (not client components)
- **Middleware** or other server-side contexts

### Server-Side Implementation Patterns

#### Option 1: Server Actions (Recommended)
```typescript
'use server';
import { sendTransactionalEmail } from '@/lib/email-service';
// This runs on the server and is secure
```

#### Option 2: API Routes
```typescript
// app/api/send-email/route.ts
import { sendTransactionalEmail } from '@/lib/email-service';
// This runs on the server and is secure
```

#### ❌ NEVER DO THIS (Client-side)
```typescript
// This would expose your API key - NEVER do this
'use client';
import { sendTransactionalEmail } from '@/lib/email-service';
```

### Authentication & Authorization

Add proper authentication to your email API routes:

```typescript
// app/api/send-project-email/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Verify user has permission for this action
  // ... your authorization logic
  
  // Now safe to send email
  const result = await sendTransactionalEmail(email, template, variables);
  return NextResponse.json(result);
}
```

## Production Considerations

1. **Rate Limits**: Monitor Loops API rate limits in production
2. **Error Monitoring**: Set up alerts for email sending failures
3. **Fallback Strategy**: Consider backup email service for critical emails
4. **Testing**: Use Loops testing features before production deployment
5. **Security**: 
   - ✅ API key stored securely in environment variables
   - ✅ Email service only called from server-side code
   - ✅ Proper authentication on email API routes
   - ✅ Input validation on all email parameters
6. **Logging**: Log email sending attempts (but not sensitive data)
7. **Monitoring**: Track email delivery rates and failures