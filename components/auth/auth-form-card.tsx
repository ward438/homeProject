'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

type AuthFormCardProps = {
  /** Card title — accepts a string or a React node (e.g. logo + text). */
  title: React.ReactNode
  /** Optional subtitle shown below the title. */
  description?: React.ReactNode
  /** Form fields and action buttons rendered inside CardContent. */
  children: React.ReactNode
  /** Additional class names applied to the Card root element. */
  className?: string
}

/**
 * Shared card shell used by all auth forms.
 * Renders a Card with a centered header (title + description) and a content
 * area for the form fields. Each auth form is responsible for its own outer
 * container div and any elements rendered outside the card.
 */
export function AuthFormCard({
  title,
  description,
  children,
  className
}: AuthFormCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex flex-col items-center justify-center gap-4">
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
