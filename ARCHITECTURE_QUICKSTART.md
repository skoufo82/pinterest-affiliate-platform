# Architecture Diagram - Quick Start Guide

## What You Have

Your Pinterest Affiliate Platform now has comprehensive architecture documentation:

1. **ARCHITECTURE.md** - Complete written documentation
2. **architecture-diagram.md** - Interactive Mermaid diagram (auto-rendered by GitHub)
3. **architecture-diagram-template.xml** - Draw.io template you can import and customize
4. **ARCHITECTURE_GUIDE.md** - Detailed guide for creating and maintaining diagrams

## Quick Start: View the Diagram

### Option 1: View on GitHub (Easiest)

1. Push these files to your GitHub repository:
   ```bash
   git add ARCHITECTURE.md architecture-diagram.md ARCHITECTURE_GUIDE.md
   git commit -m "Add architecture documentation and diagrams"
   git push origin main
   ```

2. Navigate to your repository on GitHub

3. Click on `architecture-diagram.md` - GitHub will automatically render the Mermaid diagram!

### Option 2: Create Custom Draw.io Diagram

1. Go to https://app.diagrams.net/

2. Click "Open Existing Diagram"

3. Select "Device" and choose `architecture-diagram-template.xml` from your repository

4. The diagram will open with all components pre-configured

5. Customize as needed:
   - Drag components to rearrange
   - Double-click text to edit
   - Add/remove components
   - Change colors and styles

6. Export as PNG:
   - File → Export as → PNG
   - Save as `architecture-diagram.png`
   - Place in repository root

7. Update README to display the image:
   ```markdown
   ## System Architecture
   
   ![Architecture Diagram](./architecture-diagram.png)
   ```

## What's Included in the Template

The Draw.io template includes:

### Components
- **Users**: Public and Admin user actors
- **Frontend Layer**: React SPA, Admin Portal, CloudFront, Custom Domain
- **API Layer**: API Gateway, Cognito Authorizer
- **Compute Layer**: All Lambda functions organized by purpose
- **Data Layer**: DynamoDB, S3, CloudFront CDN, Cognito, Parameter Store
- **External Services**: Amazon PA-API, Associates, AdSense
- **Monitoring**: CloudWatch, Dashboard, EventBridge, Alarms, SNS, SES
- **Deployment**: GitHub, AWS CDK, Amplify CI/CD

### Connections
- Solid lines for data flow
- Dashed lines for triggers and events
- Color-coded by layer

### Metadata
- Production URLs
- AWS Resource IDs
- Monitoring details
- Last updated date

## Customization Tips

### Change Colors

The template uses this color scheme:
- Green (#d5e8d4) - Frontend & Data
- Orange (#ffe6cc) - API Layer
- Red (#f8cecc) - Compute (Lambda)
- Blue (#dae8fc) - Data Layer
- Purple (#e1d5e7) - External Services
- Yellow (#fff2cc) - Monitoring
- Gray (#f5f5f5) - Deployment

To change:
1. Select component
2. Right panel → Style → Fill Color
3. Choose new color

### Add Components

1. Drag from left sidebar
2. Position in appropriate layer
3. Connect with arrows
4. Update legend if needed

### Update Text

1. Double-click any component
2. Edit text directly
3. Use `<br>` for line breaks
4. Press Escape when done

### Export Options

**For GitHub README**:
- Format: PNG
- Resolution: 300 DPI
- Background: White
- Border: 10px

**For Documentation**:
- Format: PDF
- Quality: High
- Include: All pages

**For Presentations**:
- Format: SVG (scalable)
- Transparent background
- High quality

## Maintenance

### When to Update

Update the diagram when you:
- Add new AWS services
- Modify data flow
- Change external integrations
- Add new features
- Update monitoring setup

### Update Process

1. **Update Mermaid** (for GitHub):
   - Edit `architecture-diagram.md`
   - Modify Mermaid code
   - Commit and push

2. **Update Draw.io** (for detailed visuals):
   - Open `architecture-diagram-template.xml`
   - Make changes
   - Export new PNG
   - Commit both files

3. **Update Documentation**:
   - Update `ARCHITECTURE.md`
   - Add new component descriptions
   - Update data flow sections

## Troubleshooting

### Mermaid Not Rendering on GitHub

**Problem**: Diagram shows as code block

**Solution**: 
- Ensure you're viewing on GitHub (not local viewer)
- Check Mermaid syntax at https://mermaid.live/
- Verify triple backticks are correct: ```mermaid

### Draw.io File Won't Open

**Problem**: Template file doesn't open

**Solution**:
- Try web version: https://app.diagrams.net/
- Ensure file downloaded completely
- Check file extension is `.xml`

### Export Quality Poor

**Problem**: PNG export looks blurry

**Solution**:
- Increase DPI in export settings (300+)
- Use larger canvas size
- Export as SVG for scalable graphics

## Next Steps

1. **View the Mermaid diagram** on GitHub by pushing the files

2. **Customize the Draw.io template** to match your specific needs

3. **Export and display** in your README

4. **Keep updated** as your architecture evolves

5. **Share with team** for documentation and onboarding

## Resources

- **Mermaid Live Editor**: https://mermaid.live/
- **Draw.io Web**: https://app.diagrams.net/
- **AWS Architecture Icons**: https://aws.amazon.com/architecture/icons/
- **Full Guide**: See ARCHITECTURE_GUIDE.md for detailed instructions

---

**Need Help?**

- Check ARCHITECTURE_GUIDE.md for detailed instructions
- Visit Draw.io documentation: https://www.diagrams.net/doc/
- View Mermaid docs: https://mermaid.js.org/

Your architecture is now fully documented and ready to share! 🎉
