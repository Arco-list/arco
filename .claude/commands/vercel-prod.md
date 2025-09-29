Deploy to production environment.

```bash
cd app && npx vercel --prod && echo "✅ Production deployed: https://verkehrsguru.tinkso.fr"
```

**What this does:**

- Changes to app directory
- Deploys to production environment (uses production env vars)
- Automatically updates custom domain `verkehrsguru.tinkso.fr`
- Confirms deployment success

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

```bash
# Check deployment status
npx vercel ls | head -3

# Check aliases
npx vercel alias ls | grep verkehrsguru

# Test endpoints
curl https://verkehrsguru-tinkso.vercel.app/api/health
curl https://verkehrsguru.tinkso.fr/api/health
```

## Notes

- Production deployments automatically update the custom domain
- Always test in pre-production before deploying to production
- Webhook endpoints will use environment-appropriate secrets
