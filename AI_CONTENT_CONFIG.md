# AI Weekly Content Generation - Configuration

## Overview
This system uses OpenAI to generate weekly social media content for 49 North/TechWerks, following a Monday-Wednesday-Friday pattern with intelligent context awareness.

---

## Google Sheet Setup

### New Tab: `AI_Content_Foundation`

**Purpose**: Provides AI with foundational knowledge for content generation

**Columns**:
- **A: Category** (Company Description, Mental Armor Skills, Content Guidelines, Brand Voice)
- **B: Item Name** (e.g., "Self-Awareness", "Long Description", "Tone Guidelines")
- **C: Content** (Full text/description)
- **D: Usage Notes** (When/how to use this)

**Example Rows**:

| Category | Item Name | Content | Usage Notes |
|----------|-----------|---------|-------------|
| Company Description | Long Description | TechWerks, LLC is a Service-Disabled Veteran-Owned... | Use for context in all posts |
| Company Description | 49 North Division | 49 North is TechWerks' training and resilience division... | Use when discussing Mental Armor |
| Mental Armor Skills | Self-Awareness | The ability to recognize your own thoughts, emotions... | Monday resilience content |
| Mental Armor Skills | Self-Regulation | Managing emotions and impulses effectively... | Monday resilience content |
| Mental Armor Skills | Optimism | Maintaining realistic positive outlook under stress... | Monday resilience content |
| Mental Armor Skills | Mental Agility | Flexibility in thinking and problem-solving... | Monday resilience content |
| Mental Armor Skills | Strengths of Character | Identifying and leveraging personal values... | Monday resilience content |
| Mental Armor Skills | Connection | Building and maintaining meaningful relationships... | Monday resilience content |
| Content Guidelines | Brand Voice | Professional, empowering, evidence-based, authentic... | All content |
| Content Guidelines | Hashtag Strategy | #Resilience #Leadership #MentalArmor #49North #Wellbeing | Standard hashtags |
| Content Guidelines | CTA Standard | Visit www.mymentalarmor.com to learn more | Friday posts |

---

## AI Content Generation Patterns

### **Monday: Resilience Skill Spotlight**
**Goal**: Introduce a resilience skill or concept with an engaging question

**Pattern**:
- Hook with relatable workplace/life challenge
- Introduce the skill/concept
- Ask thought-provoking question to audience
- Light on CTA (build awareness)

**Example Prompt Elements**:
- "What skill from Mental Armor curriculum hasn't been featured recently?"
- "What workplace challenge is timely/seasonal?"
- "Craft a question that sparks reflection"

**AI Considerations**:
- Check last 4 Monday posts to avoid repetition
- Align with current events/seasons when relevant
- Focus on universal workplace challenges

---

### **Wednesday: Follow-Up & Deeper Dive**
**Goal**: Build on Monday's topic with deeper insights or practical application

**Pattern**:
- Reference Monday's concept (subtly, not explicitly)
- Provide science-backed insight or real-world example
- Offer 1-2 practical tips or reflection points
- Medium CTA (invite engagement)

**Example Prompt Elements**:
- "Read Monday's post - what was the core concept?"
- "Provide neuroscience or research backing"
- "Give actionable steps to practice the skill"

**AI Considerations**:
- Read most recent Monday post for context
- Add depth without being preachy
- Include evidence/research when possible

---

### **Friday: Call to Action**
**Goal**: Convert the week's engagement into website visits or inquiries

**Pattern**:
- Synthesize Monday + Wednesday themes
- Position 49 North/Mental Armor as the solution
- Strong, clear CTA to website or resource
- Include link and invitation to connect

**Example Prompt Elements**:
- "What problem did Monday/Wednesday highlight?"
- "How does 49 North solve this?"
- "Compelling reason to visit website NOW"

**AI Considerations**:
- Read Monday + Wednesday posts
- Create urgency without being pushy
- Link to www.mymentalarmor.com
- Mention organizational training options

---

## Custom Mode

**When User Selects "Custom"**:
- Show text input: "Describe the topic or theme you'd like AI to write about"
- AI ignores day-of-week patterns
- Uses user input as primary prompt
- Still references recent posts to avoid repetition
- Still optimizes for LinkedIn/Facebook/Blog formats

**Example Custom Inputs**:
- "Holiday stress and family resilience"
- "Year-end reflection and goal setting"
- "Veteran's Day tribute with mental strength theme"
- "Women's leadership and resilience"

---

## Platform Optimization

### **LinkedIn** (Max 3,000 chars, optimal 150-300)
- Professional tone
- Industry-relevant examples
- Hashtags (5-10)
- Paragraph breaks for readability
- Optional: Call out specific industries

### **Facebook** (Max 63,206 chars, optimal 100-250)
- Conversational tone
- Relatable, personal stories
- Questions to drive comments
- Hashtags (3-5)
- Emoji use encouraged (sparingly)

### **Blog** (500-800 words)
- Full article format
- Introduction, body, conclusion
- Subheadings (H2/H3)
- 2-3 paragraph introduction
- Bullet points or numbered lists
- Strong conclusion with CTA
- SEO-friendly keywords

---

## Image/Video Suggestions

**AI Should Suggest**:
1. **Type**: Photo, illustration, infographic, or video
2. **Content**: What should be depicted
3. **Mood/Style**: Professional, warm, energetic, calm, etc.
4. **Example Search Terms**: For stock photo sites
5. **WordPress Media Library Match**: Check if existing image fits

**Monday Suggestions** (Skill Spotlight):
- Infographic showing skill components
- Workplace scenario photo (team meeting, individual reflection)
- Abstract concepts (mountain climbing, puzzle pieces)

**Wednesday Suggestions** (Follow-Up):
- Charts/graphs (research data)
- Real-world application photos
- Before/after scenarios

**Friday Suggestions** (CTA):
- 49 North branding
- Training session photos
- Website screenshots
- Professional headshots (team)

---

## AI Response Format

```json
{
  "suggestions": [
    {
      "id": 1,
      "title": "Suggestion Title",
      "linkedinPost": "...",
      "facebookPost": "...",
      "blogPost": "...",
      "hashtags": ["#Resilience", "#Leadership"],
      "imageSuggestion": {
        "type": "Photo",
        "description": "Team meeting with diverse professionals engaged in discussion",
        "mood": "Professional, collaborative",
        "searchTerms": "diverse team meeting, workplace collaboration, professional discussion",
        "stockSites": ["Unsplash: 'team collaboration'", "Pexels: 'office teamwork'"]
      }
    },
    // ... 2 more suggestions
  ],
  "context": {
    "dayType": "Monday",
    "skillFocused": "Self-Awareness",
    "recentPostsReviewed": 3,
    "customPrompt": null
  }
}
```

---

## Environment Variables Needed

```
OPENAI_API_KEY=sk-...
```

**Model Recommendation**: GPT-4 Turbo for best quality, or GPT-3.5 Turbo for cost savings

---

## User Workflow

1. Navigate to Social Media Operations
2. See "🤖 AI Weekly Content Assistant" card at top
3. Select dropdown:
   - "Monday - Resilience Skill Spotlight"
   - "Wednesday - Follow-Up & Deeper Dive"
   - "Friday - Call to Action"
   - "Custom Theme..."
4. (If Custom) Enter custom prompt in text field
5. Click "Generate Content Suggestions"
6. Wait 10-20 seconds (loading indicator)
7. See 3 AI-generated post suggestions
8. Each suggestion shows:
   - Preview of LinkedIn/Facebook/Blog versions
   - Image suggestion card
   - "Use This Suggestion" button
9. Click "Use This Suggestion":
   - Opens Post Composer Modal
   - Pre-fills all fields (title, content, platforms)
   - User adds image URL
   - User reviews/edits
   - User saves as draft or schedules

---

## Mental Armor Curriculum Skills (To Add to Sheet)

**Please provide the full list of skills with descriptions**

This will be added to the `AI_Content_Foundation` tab so AI can reference them dynamically.

---

## Notes

- AI will ALWAYS check recent posts before generating (avoid repetition)
- AI will adapt tone based on day type and custom input
- AI will NOT post automatically - only suggest
- User has full control to edit before posting
- System is designed for weekly cadence but can be used anytime

