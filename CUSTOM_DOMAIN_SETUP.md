# Custom Domain Setup for Amplify

Your Amplify app is live at: https://main.d2zsamo7mttch3.amplifyapp.com/

This guide will help you connect your custom domain from Route 53 (in another AWS account).

## Prerequisites

- Custom domain registered and managed in Route 53 (different AWS account)
- Access to both AWS accounts
- Domain name (e.g., `example.com`)

## Step-by-Step Setup

### 1. Add Domain in Amplify Console

**In Account 788222620487 (where Amplify is deployed):**

1. Go to AWS Amplify Console:
   ```
   https://console.aws.amazon.com/amplify/home?region=us-east-1
   ```

2. Select your app: `pinterest-affiliate-platform`

3. Click **"Domain management"** in the left sidebar

4. Click **"Add domain"**

5. Enter your domain name (e.g., `mystore.com`)

6. Choose configuration:
   - ✅ Root domain: `mystore.com`
   - ✅ www subdomain: `www.mystore.com`
   - Click **"Configure domain"**

7. **IMPORTANT**: Amplify will show you DNS records to add. Keep this page open!

### 2. Get DNS Records from Amplify

Amplify will provide records like:

**For Root Domain:**
```
Type: CNAME (or ANAME/ALIAS)
Name: mystore.com
Value: d2zsamo7mttch3.amplifyapp.com
```

**For WWW Subdomain:**
```
Type: CNAME
Name: www.mystore.com
Value: d2zsamo7mttch3.amplifyapp.com
```

**For SSL Certificate Validation:**
```
Type: CNAME
Name: _abc123xyz.mystore.com
Value: _def456uvw.acm-validations.aws.
```

### 3. Add DNS Records in Route 53 (Other Account)

**In your Route 53 account (where domain is hosted):**

1. Go to Route 53 Console:
   ```
   https://console.aws.amazon.com/route53/
   ```

2. Click **"Hosted zones"**

3. Select your domain's hosted zone

4. Click **"Create record"**

#### Add Root Domain Record:

**Option A: If Route 53 supports ALIAS records (recommended):**
- **Record name**: Leave blank (for root domain)
- **Record type**: A - IPv4 address
- **Alias**: Toggle ON
- **Route traffic to**: 
  - Select "Alias to CloudFront distribution"
  - Or manually enter the Amplify domain
- **Value**: `d2zsamo7mttch3.amplifyapp.com`
- Click **"Create records"**

**Option B: If using CNAME (for subdomains only):**
- **Record name**: `www`
- **Record type**: CNAME
- **Value**: `d2zsamo7mttch3.amplifyapp.com`
- **TTL**: 300
- Click **"Create records"**

#### Add SSL Validation Records:

For each SSL validation record Amplify provides:

- **Record name**: Copy from Amplify (e.g., `_abc123xyz`)
- **Record type**: CNAME
- **Value**: Copy from Amplify (e.g., `_def456uvw.acm-validations.aws.`)
- **TTL**: 300
- Click **"Create records"**

### 4. Wait for SSL Certificate

Back in the Amplify Console:

1. The domain status will show "Pending verification"
2. Wait 5-15 minutes for:
   - DNS propagation
   - SSL certificate validation
   - Certificate issuance
3. Status will change to "Available" when ready

### 5. Verify Your Custom Domain

Once status is "Available":

1. Visit your custom domain: `https://mystore.com`
2. Verify:
   - ✅ Site loads correctly
   - ✅ SSL certificate is valid (padlock icon)
   - ✅ Products display
   - ✅ Admin dashboard works

## Troubleshooting

### Domain Shows "Pending Verification" for Too Long

**Check DNS propagation:**
```bash
dig mystore.com
nslookup mystore.com
```

**Verify CNAME records are correct:**
- Ensure no trailing dots unless required
- Check for typos in the Amplify domain
- Verify records are in the correct hosted zone

### SSL Certificate Fails

**Common issues:**
- SSL validation CNAME records not added correctly
- DNS propagation delay (wait up to 30 minutes)
- Incorrect hosted zone

**Solution:**
1. Double-check the validation CNAME records
2. Ensure they match exactly what Amplify provided
3. Wait for DNS propagation

### "This site can't be reached" Error

**Possible causes:**
- DNS records not propagated yet (wait 5-30 minutes)
- Incorrect CNAME value
- Domain not added in Amplify

**Solution:**
1. Verify DNS records in Route 53
2. Check Amplify domain management shows your domain
3. Wait for propagation

### Mixed Content Warnings

If you see warnings about insecure content:

**Solution:**
- Ensure all resources (images, API calls) use HTTPS
- Your API Gateway already uses HTTPS ✅
- CloudFront CDN uses HTTPS ✅

## Alternative: Transfer Domain to Amplify Account

If you have trouble with cross-account setup:

### Option 1: Transfer Hosted Zone

1. Export hosted zone from old account
2. Create new hosted zone in account 788222620487
3. Update domain registrar nameservers
4. Let Amplify manage DNS automatically

### Option 2: Use Route 53 Delegation

1. Create a subdomain in the Amplify account
2. Delegate the subdomain from the main account
3. Use subdomain for your store (e.g., `store.mystore.com`)

## Best Practices

### Redirect www to Root (or vice versa)

In Amplify Console → Domain management:
- Configure redirect from `www.mystore.com` → `mystore.com`
- Or vice versa for consistency

### Enable HTTPS Only

Amplify automatically redirects HTTP → HTTPS ✅

### Monitor Certificate Expiration

Amplify automatically renews SSL certificates ✅

### Set Up Monitoring

1. CloudWatch alarms for Amplify build failures
2. Route 53 health checks for domain availability
3. Billing alerts for unexpected costs

## DNS Record Examples

### Example 1: Root Domain with ALIAS

```
Type: A
Name: mystore.com
Alias: Yes
Target: d2zsamo7mttch3.amplifyapp.com
```

### Example 2: WWW Subdomain

```
Type: CNAME
Name: www.mystore.com
Value: d2zsamo7mttch3.amplifyapp.com
TTL: 300
```

### Example 3: SSL Validation

```
Type: CNAME
Name: _1234567890abcdef.mystore.com
Value: _fedcba0987654321.acm-validations.aws.
TTL: 300
```

## Verification Commands

Check DNS propagation:
```bash
# Check A record
dig mystore.com

# Check CNAME
dig www.mystore.com

# Check from specific DNS server
dig @8.8.8.8 mystore.com

# Check SSL certificate
openssl s_client -connect mystore.com:443 -servername mystore.com
```

## Timeline

- **DNS record creation**: Immediate
- **DNS propagation**: 5-30 minutes
- **SSL certificate validation**: 5-15 minutes
- **Total time**: 15-45 minutes typically

## Support

If you encounter issues:

1. Check Amplify Console logs
2. Verify DNS records in Route 53
3. Use `dig` or `nslookup` to check propagation
4. Check AWS Support or Amplify documentation

---

**Once configured, your custom domain will be live with automatic SSL!** 🎉
