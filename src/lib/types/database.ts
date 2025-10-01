import { Prisma } from '@prisma/client'

// User types
export type User = Prisma.UserGetPayload<{}>
export type UserWithOrganization = Prisma.UserGetPayload<{
  include: { organization: true }
}>
export type UserCreateInput = Prisma.UserCreateInput
export type UserUpdateInput = Prisma.UserUpdateInput

// Organization types
export type Organization = Prisma.OrganizationGetPayload<{}>
export type OrganizationWithMembers = Prisma.OrganizationGetPayload<{
  include: { members: true, owner: true }
}>
export type OrganizationCreateInput = Prisma.OrganizationCreateInput
export type OrganizationUpdateInput = Prisma.OrganizationUpdateInput

// Repository Analysis types
export type RepositoryAnalysis = Prisma.RepositoryAnalysisGetPayload<{}>
export type RepositoryAnalysisWithRelations = Prisma.RepositoryAnalysisGetPayload<{
  include: { user: true, organization: true }
}>
export type RepositoryAnalysisCreateInput = Prisma.RepositoryAnalysisCreateInput
export type RepositoryAnalysisUpdateInput = Prisma.RepositoryAnalysisUpdateInput

// Baseline Data types
export type BaselineData = Prisma.BaselineDataGetPayload<{}>
export type BaselineDataCreateInput = Prisma.BaselineDataCreateInput
export type BaselineDataUpdateInput = Prisma.BaselineDataUpdateInput

// Credit Transaction types
export type CreditTransaction = Prisma.CreditTransactionGetPayload<{}>
export type CreditTransactionWithUser = Prisma.CreditTransactionGetPayload<{
  include: { user: true }
}>
export type CreditTransactionCreateInput = Prisma.CreditTransactionCreateInput

// Invitation types
export type Invitation = Prisma.InvitationGetPayload<{}>
export type InvitationWithRelations = Prisma.InvitationGetPayload<{
  include: { organization: true, inviter: true }
}>
export type InvitationCreateInput = Prisma.InvitationCreateInput
export type InvitationUpdateInput = Prisma.InvitationUpdateInput

// Enums
export { UserRole, AnalysisStatus, TransactionType, InvitationStatus } from '@prisma/client'

// Analysis Result Types
export interface AnalysisResult {
  complianceScore: number
  recommendations: Recommendation[]
  baselineMatches: BaselineMatch[]
  issues: Issue[]
}

export interface Recommendation {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: string
  actionItems: string[]
  resources: Resource[]
}

export interface BaselineMatch {
  feature: string
  status: 'baseline' | 'limited' | 'not-baseline'
  confidence: number
  description: string
  documentation?: string
}

export interface Issue {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  description: string
  file?: string
  line?: number
  column?: number
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface Resource {
  title: string
  url: string
  type: 'documentation' | 'tutorial' | 'example' | 'tool'
}

// Repository Metadata Types
export interface RepositoryMetadata {
  repositorySize: number
  fileCount: number
  processingTime: number
  aiProvider: string
  languages: string[]
  frameworks: string[]
  dependencies: string[]
}

// Organization Settings Types
export interface OrganizationSettings {
  aiProvider?: AIProviderConfig
  pricingConfig?: PricingConfig
  usageLimits?: UsageLimits
  notifications?: NotificationSettings
}

export interface AIProviderConfig {
  primary: string
  fallback?: string[]
  apiKeys: Record<string, string>
  models: Record<string, string>
  rateLimits: Record<string, number>
}

export interface PricingConfig {
  creditCostPerAnalysis: number
  markupPercentage: number
  packages: CreditPackage[]
  freeTierLimits: FreeTierLimits
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price: number
  popular?: boolean
}

export interface FreeTierLimits {
  creditsPerMonth: number
  analysesPerDay: number
  maxRepositorySize: number
}

export interface UsageLimits {
  maxAnalysesPerDay: number
  maxAnalysesPerMonth: number
  maxRepositorySize: number
  maxConcurrentAnalyses: number
}

export interface NotificationSettings {
  lowCreditThreshold: number
  emailNotifications: boolean
  webhookUrl?: string
}

// Vector Search Types
export interface VectorSearchResult {
  id: string
  feature: string
  category: string
  status: string
  description: string
  documentation: string
  browserSupport: any
  lastUpdated: Date
  similarity: number
}