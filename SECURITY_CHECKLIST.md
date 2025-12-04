# Security Checklist - Pinterest Affiliate Platform

## 🔒 Pre-Production Security Checklist

Use this checklist before deploying to production or making the site public.

---

## ✅ Credentials & Secrets

- [x] No hardcoded passwords in code
- [x] No API keys committed to Git
- [x] `.env` files in `.gitignore`
- [x] Environment variables configured in Amplify Console
- [ ] **PA-API credentials updated in Parameter Store** ⚠️ ACTION REQUIRED
  ```bash
  aws ssm put-parameter --name "/amazon-affiliate/pa-api/access-key" --value "YOUR_KEY" --overwrite
  aws ssm put-parameter --name "/amazon-affiliate/pa-api/secret-key" --value "YOUR_SECRET" --type "SecureString" --overwrite
  aws ssm put-parameter --name "/amazon-affiliate/pa-api/partner-tag" --value "YOUR_TAG" --overwrite
  ```
- [ ] Amazon Associates tag configured
- [ ] Google AdSense account set up (if using)

---

## 🔐 Authentication & Authorization

- [x] Cognito User Pool configured
- [x] Admin group created
- [x] Self-signup disabled
- [x] Strong password policy enabled (8+ chars, uppercase, lowercase, digits)
- [x] Email verification required
- [ ] **At least one admin user created**
  ```bash
  # Create via AWS Console or CLI
  aws cognito-idp admin-create-user \
    --user-pool-id us-east-1_dgrSfYa3L \
    --username admin \
    --user-attributes Name=email,Value=your-email@example.com \
    --temporary-password "TempPass123!"
  ```
- [ ] **Admin user added to Admins group**
- [ ] Test login with admin credentials
- [ ] Verify JWT tokens are working
- [ ] Test admin portal access at `/kbportal`

---

## 🌐 Infrastructure Security

- [x] HTTPS enforced on all endpoints
- [x] API Gateway CORS configured
- [x] Lambda IAM roles with least privilege
- [x] DynamoDB encryption at rest enabled
- [x] S3 bucket encryption enabled
- [x] CloudWatch logging enabled
- [ ] **Review IAM policies for overly permissive access**
- [ ] **Verify S3 bucket only contains product images**
- [ ] **Test API endpoints are not publicly writable**

---

## 📧 Email Configuration

- [x] AWS SES configured
- [ ] **SES moved out of sandbox mode** (if sending to non-verified emails)
  - See `REQUEST_SES_PRODUCTION.md` for instructions
- [ ] **Admin email verified in SES**
- [ ] **Test email delivery** (user invitations, password resets)
- [ ] **SNS topic subscribed to admin email**
  ```bash
  aws sns subscribe \
    --topic-arn arn:aws:sns:us-east-1:788222620487:pinterest-affiliate-price-sync-alerts \
    --protocol email \
    --notification-endpoint your-email@example.com
  ```

---

## 🔔 Monitoring & Alerts

- [x] CloudWatch alarms configured
- [x] SNS topic for alerts created
- [ ] **SNS topic subscribed to admin email** (see above)
- [ ] **Test CloudWatch alarms**
- [ ] **Review CloudWatch dashboard**
- [ ] **Set up log retention policies**
- [ ] **Configure billing alerts**

---

## 🛡️ Application Security

- [x] Input validation on all forms
- [x] XSS prevention (React default)
- [x] CSRF protection (JWT tokens)
- [x] Rate limiting via API Gateway
- [x] Error messages don't expose sensitive info
- [ ] **Test for SQL injection** (N/A - using DynamoDB)
- [ ] **Test for XSS vulnerabilities**
- [ ] **Test authentication bypass attempts**
- [ ] **Verify admin endpoints require authentication**

---

## 🔍 Data Protection

- [x] Encryption at rest (DynamoDB, S3)
- [x] Encryption in transit (HTTPS)
- [x] Secrets in Parameter Store
- [ ] **Verify no PII in logs**
- [ ] **Review data retention policies**
- [ ] **Test data backup and restore**
- [ ] **Verify DynamoDB point-in-time recovery enabled**

---

## 🌍 Domain & SSL

- [ ] **Custom domain configured** (koufobunch.com)
- [ ] **SSL certificate issued and active**
- [ ] **DNS records properly configured**
- [ ] **Test HTTPS redirect**
- [ ] **Verify SSL certificate is valid**
- [ ] **Test domain from multiple locations**

---

## 📱 Frontend Security

- [x] Environment variables not exposed in client
- [x] API keys not in frontend code
- [x] Sensitive operations require authentication
- [ ] **Review browser console for exposed data**
- [ ] **Test with browser dev tools open**
- [ ] **Verify no sensitive data in localStorage**
- [ ] **Test CORS from different origins**

---

## 🧪 Testing

- [ ] **Test all API endpoints**
  - Public endpoints (products, categories)
  - Admin endpoints (CRUD operations)
  - Authentication endpoints (login, logout)
- [ ] **Test error handling**
  - Invalid inputs
  - Network errors
  - Authentication failures
- [ ] **Test edge cases**
  - Empty product list
  - Missing images
  - Invalid product IDs
- [ ] **Load testing** (optional)
- [ ] **Security penetration testing** (optional)

---

## 📊 Price Sync Security

- [ ] **PA-API credentials updated** (see top of checklist)
- [ ] **Test manual price sync**
- [ ] **Verify automated sync schedule**
- [ ] **Test sync failure alerts**
- [ ] **Review sync history logs**
- [ ] **Verify rate limiting compliance** (1 req/sec)

---

## 🚀 Deployment Security

- [x] Infrastructure as code (AWS CDK)
- [x] Automated deployments (Amplify)
- [ ] **Review Amplify build logs**
- [ ] **Verify environment variables in Amplify**
- [ ] **Test deployment rollback**
- [ ] **Document deployment process**
- [ ] **Set up staging environment** (optional)

---

## 📝 Documentation Security

- [x] No passwords in documentation
- [x] No real API keys in examples
- [x] AWS Account ID documented (acceptable)
- [ ] **Review all documentation for sensitive info**
- [ ] **Update security documentation**
- [ ] **Document incident response plan**

---

## 🔄 Ongoing Security

- [ ] **Schedule regular security audits**
- [ ] **Monitor AWS Security Hub** (if enabled)
- [ ] **Review CloudWatch logs weekly**
- [ ] **Update dependencies regularly**
  ```bash
  npm audit
  npm audit fix
  ```
- [ ] **Monitor AWS service announcements**
- [ ] **Review IAM access regularly**
- [ ] **Rotate credentials periodically**

---

## 🚨 Incident Response

- [ ] **Document incident response plan**
- [ ] **Identify security contacts**
- [ ] **Set up emergency communication channels**
- [ ] **Test incident response procedures**
- [ ] **Document escalation procedures**

---

## 📋 Compliance (if applicable)

- [ ] **GDPR compliance** (if serving EU users)
- [ ] **CCPA compliance** (if serving CA users)
- [ ] **Cookie consent banner** (if required)
- [ ] **Privacy policy published**
- [ ] **Terms of service published**
- [ ] **Data processing agreements**

---

## ✅ Final Pre-Launch Checklist

Before making the site public:

1. [ ] All items above completed
2. [ ] PA-API credentials updated and tested
3. [ ] At least one admin user created and tested
4. [ ] Email notifications working
5. [ ] CloudWatch alarms subscribed
6. [ ] Custom domain configured with SSL
7. [ ] All API endpoints tested
8. [ ] Security audit report reviewed
9. [ ] Backup and recovery tested
10. [ ] Monitoring dashboard reviewed

---

## 🎯 Quick Security Test

Run these quick tests before launch:

```bash
# 1. Test public API (should work)
curl https://koufobunch.com/api/products

# 2. Test admin API without auth (should fail)
curl https://koufobunch.com/api/admin/products

# 3. Test admin API with auth (should work)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://koufobunch.com/api/admin/products

# 4. Test HTTPS redirect
curl -I http://koufobunch.com

# 5. Check SSL certificate
openssl s_client -connect koufobunch.com:443 -servername koufobunch.com
```

---

## 📞 Security Contacts

- **AWS Support**: https://console.aws.amazon.com/support/
- **Security Issues**: Report via AWS Security Hub
- **Emergency**: Document your emergency contact process

---

## 📚 Security Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Well-Architected Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)

---

**Last Updated**: December 4, 2024  
**Next Review**: Before production launch and quarterly thereafter

---

*Keep this checklist updated as your security requirements evolve.*
