const { z } = require("zod");

// Input accepted by POST /enrich
const EnrichInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "title must not be empty")
    .max(200, "title must be 200 characters or fewer"),

  description: z.union([
    z
      .string()
      .max(4000, "description must be 4000 characters or fewer"),
    z.null()
  ])
});

// Output our API promises to return
const EnrichOutputSchema = z.object({
  category: z.enum([
    "fiction",
    "nonfiction",
    "poetry",
    "children",
    "other"
  ]),

  summary: z
    .string()
    .trim()
    .min(1)
    .max(300),

  confidence: z
    .number()
    .min(0)
    .max(1),

  quality_flags: z.array(
    z.enum([
      "missing_description",
      "ambiguous_category",
      "possible_prompt_injection"
    ])
  )
});

module.exports = {
  EnrichInputSchema,
  EnrichOutputSchema
};