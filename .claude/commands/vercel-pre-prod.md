Deploy to pre-production environment (preview) and update static URL.

\`\`\`bash
cd app && npx vercel --yes && DEPLOYMENT_URL=$(npx vercel ls | head -1) && npx vercel alias $DEPLOYMENT_URL verkehrsguru-tinkso.vercel.app && echo "✅ Pre-production deployed: https://verkehrsguru-tinkso.vercel.app"
\`\`\`

**What this does:**

- Changes to app directory
- Deploys to preview environment with auto-confirmation (uses pre-production env vars)
- Gets the latest deployment URL from deployment list
- Updates the static alias `verkehrsguru-tinkso.vercel.app`
- Confirms deployment success

## Project Configuration

### Required Vercel Project Setup

- **Organization**: `tinkso`
- **Project Name**: `verkehrsguru`
- **Project ID**: `prj_zV2e3op7X3NnlsUiJoP2agdugo6L`
- **Org ID**: `team_2BGzRTqeeJ0PefqwYrMXj4Ev`

### Troubleshooting Project Linking

If deployment fails with wrong project, ensure correct `.vercel/project.json`:

\`\`\`json
{"projectId":"prj_zV2e3op7X3NnlsUiJoP2agdugo6L","orgId":"team_2BGzRTqeeJ0PefqwYrMXj4Ev"}
\`\`\`

**Commands to fix project linking:**

\`\`\`bash
# Remove incorrect link
rm -rf .vercel

# Manually create correct project configuration
mkdir -p .vercel
echo '{"projectId":"prj_zV2e3op7X3NnlsUiJoP2agdugo6L","orgId":"team_2BGzRTqeeJ0PefqwYrMXj4Ev"}' > .vercel/project.json

# Deploy to correct project
npx vercel --yes
\`\`\`

## Environment Details

### Pre-Production (`/vercel-pre-prod`)

- **URL**: https://verkehrsguru-tinkso.vercel.app
- **Environment**: Preview/Development
- **Variables**: "All Pre-Production Environments"
- **Stripe**: Test mode keys
- **Purpose**: Testing, staging, webhook development

### Production (`/vercel-prod`)

- **URL**: https://verkehrsguru.tinkso.fr
- **Environment**: Production
- **Variables**: "Production"
- **Stripe**: Live mode keys
- **Purpose**: Live users, stable releases

## Verification Commands

After deployment, you can verify with:

\`\`\`bash
# Check deployment status
npx vercel ls | head -5

# Check project configuration
cat .vercel/project.json

# Verify correct organization and project
npx vercel projects ls --scope=tinkso | grep verkehrsguru

# Test endpoints
curl https://verkehrsguru-tinkso.vercel.app/
curl https://verkehrsguru.tinkso.fr/
\`\`\`

## Notes

- **Project Linking**: Always ensure deployment goes to `tinkso/verkehrsguru`, not `tinkso/app`
- **Manual Alias**: Pre-production deployments require manual alias update to `verkehrsguru-tinkso.vercel.app`
- **Production**: Production deployments automatically update the custom domain `verkehrsguru.tinkso.fr`
- **Testing**: Always test in pre-production before deploying to production
- **Environment Variables**: Webhook endpoints will use environment-appropriate secrets
- **CLI Version**: Tested with Vercel CLI 41.7.8, commands may vary with different versions
- **Authentication**: Ensure correct Vercel account (`bartek-2831`) is logged in before deployment
