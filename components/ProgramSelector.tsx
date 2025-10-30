import React from 'react'

interface Program {
  id: string
  name: string
  description: string
  start_date: string
  end_date: string
  status: string
  total_budget?: number
  enrolled_at?: string
  manager?: {
    id: string
    name: string
    email: string
  }
}

interface ProgramSelectorProps {
  programs: Program[]
  onSelect: (program: Program) => void
}

const ProgramSelector: React.FC<ProgramSelectorProps> = ({
  programs,
  onSelect
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (programs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <svg
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            No Programs Available
          </h2>
          <p className="text-gray-600 mb-2">
            You haven't been enrolled in any programs yet.
          </p>
          <p className="text-gray-500 text-sm">
            Please contact your program manager to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Select Your Program
            </h1>
            <p className="text-gray-600">
              {programs.length === 1
                ? 'Click to access your program'
                : `You have access to ${programs.length} programs. Select one to continue.`}
            </p>
          </div>

          <div className="grid gap-4">
            {programs.map(program => (
              <div
                key={program.id}
                onClick={() => onSelect(program)}
                className="group border-2 border-gray-200 rounded-lg p-6
                         hover:border-blue-500 hover:bg-blue-50
                         cursor-pointer transition-all duration-200
                         hover:shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Program Name */}
                    <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-blue-700">
                      {program.name}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {program.description}
                    </p>

                    {/* Program Details */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          Start Date
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(program.start_date)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          End Date
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(program.end_date)}
                        </p>
                      </div>
                    </div>

                    {/* Status and Additional Info */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {/* Status Badge */}
                      <span className={`inline-flex items-center px-3 py-1 rounded-full font-medium ${
                        program.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : program.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
                      </span>

                      {/* Budget */}
                      {program.total_budget && (
                        <span className="text-gray-600">
                          Budget: <span className="font-semibold">
                            {formatCurrency(program.total_budget)}
                          </span>
                        </span>
                      )}

                      {/* Enrollment Date */}
                      {program.enrolled_at && (
                        <span className="text-gray-500">
                          Enrolled: {formatDate(program.enrolled_at)}
                        </span>
                      )}

                      {/* Manager Info */}
                      {program.manager && (
                        <span className="text-gray-500">
                          Manager: <span className="font-medium text-gray-700">
                            {program.manager.name}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow Icon */}
                  <svg
                    className="w-6 h-6 text-gray-400 ml-4 group-hover:text-blue-500 transition-colors flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              Need help? Contact your program manager or administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProgramSelector
