// 급여계산 유틸리티 클래스 - 고용형태별 함수 분리
export interface Employee {
  id: string;
  name: string;
  employmentType: string;
  salaryType?: string;
  salaryAmount?: number;
  probationStartDate?: Date;
  probationEndDate?: Date;
  includesWeeklyHolidayInWage?: boolean;
  weeklyWorkHours?: number;
}

export interface Contract {
  employmentType: string;
  salaryType: string;
  salaryAmount: number;
  weeklyWorkHours?: number;
  includeHolidayAllowance?: boolean;
}

export interface Schedule {
  date: Date;
  actualWorkHours: number;
  branchId: string;
  branchName: string;
}

export interface PayrollResult {
  employeeId: string;
  employeeName: string;
  employmentType: string;
  salaryType?: string;
  salaryAmount?: number;
  weeklyWorkHours?: number;
  totalWorkHours: number;
  totalBreakTime: number;
  actualWorkHours: number;
  grossPay: number;
  deductions: {
    insurance: number;
    tax: number;
    total: number;
    insuranceDetails?: {
      nationalPension: number;
      healthInsurance: number;
      longTermCare: number;
      employmentInsurance: number;
    };
    taxDetails?: {
      incomeTax: number;
      localIncomeTax: number;
    };
    // 편집 가능한 공제항목들
    editableDeductions?: {
      nationalPension: number;
      healthInsurance: number;
      longTermCare: number;
      employmentInsurance: number;
      incomeTax: number;
      localIncomeTax: number;
    };
  };
  netPay: number;
  branches: {
    branchId: string;
    branchName: string;
    workHours: number;
  }[];
  probationHours?: number;
  regularHours?: number;
  probationDays?: number; // 일급제용 수습 일수
  regularDays?: number; // 일급제용 정규 일수
  probationPay?: number;
  regularPay?: number;
  weeklyHolidayPay?: number;
  weeklyHolidayHours?: number;
  includesWeeklyHolidayInWage?: boolean;
  weeklyHolidayDetails?: Array<{
    weekStart: string;
    weekEnd: string;
    hours: number;
    pay: number;
    eligible: boolean;
    reason?: string;
  }>;
  unpaidLeaveDays?: number;
  unpaidLeaveDeduction?: number;
}

export class PayrollCalculator {
  private employee: Employee;
  private contract: Contract;
  private schedules: Schedule[];
  // 🔥 전월 이월 주 처리를 위한 "이전달 부분 주"의 실 근무시간 합계 (weekStart YYYY-MM-DD -> hours)
  private prevWeekHoursMap?: Record<string, number>;

  constructor(
    employee: Employee,
    contract: Contract,
    schedules: Schedule[],
    prevWeekHoursMap?: Record<string, number>
  ) {
    this.employee = employee;
    this.contract = contract;
    this.schedules = schedules;
    this.prevWeekHoursMap = prevWeekHoursMap;
  }

  // 🔥 고용형태별 계산 함수들
  public static calculateLaborIncomeHourly(calculator: PayrollCalculator): PayrollResult {
    return calculator.calculateLaborIncomeHourly();
  }

  public static calculateLaborIncomeMonthly(calculator: PayrollCalculator): PayrollResult {
    return calculator.calculateLaborIncomeMonthly();
  }

  public static calculateBusinessIncome(calculator: PayrollCalculator): PayrollResult {
    return calculator.calculateBusinessIncome();
  }

  public static calculateForeigner(calculator: PayrollCalculator): PayrollResult {
    return calculator.calculateForeigner();
  }

  public static calculateDailyWorker(calculator: PayrollCalculator): PayrollResult {
    return calculator.calculateDailyWorker();
  }

  // 🔥 메인 계산 함수 - 고용형태에 따라 분기
  public calculate(): PayrollResult {
    const { employmentType, salaryType } = this.contract;

    console.log('🔥 PayrollCalculator - 고용형태 확인:', {
      employmentType,
      salaryType,
      employeeName: this.employee.name
    });

    // 고용형태별 계산 함수 호출
    switch (employmentType) {
      case '근로소득':
      case '근로소득자': // 호환성을 위해 추가
        if (salaryType === 'daily' || salaryType === '일급') {
          return this.calculateLaborIncomeDaily();
        }
        return salaryType === 'hourly' || salaryType === '시급' 
          ? this.calculateLaborIncomeHourly()
          : this.calculateLaborIncomeMonthly();
      
      case '사업소득':
      case '사업소득자': // 호환성을 위해 추가
        return this.calculateBusinessIncome();
      
      case '외국인':
        return this.calculateForeigner();
      
      case '일용직':
        return this.calculateDailyWorker();
      
      default:
        console.error('🔥 지원하지 않는 고용형태:', {
          employmentType,
          salaryType,
          employeeName: this.employee.name,
          contract: this.contract
        });
        // 기본값으로 사업소득자 처리 (안전한 폴백)
        console.warn(`🔥 알 수 없는 고용형태 "${employmentType}" - 사업소득자로 처리합니다.`);
        return this.calculateBusinessIncome();
    }
  }

  // 🔥 1. 근로소득자 시급제 계산
  private calculateLaborIncomeHourly(): PayrollResult {
    console.log('🔥 근로소득자 시급제 계산 시작');
    
    // 1. 근무시간 계산
    const { totalWorkHours, totalBreakTime, actualWorkHours } = this.calculateWorkHours();
    
    // 2. 수습기간 구분
    const { probationHours, regularHours } = this.separateProbationHours();
    
    // 3. 기본급 계산 (수습기간 90% 적용)
    const salaryAmount = this.contract.salaryAmount;
    
    // 🔥 정확한 계산을 위해 부동소수점 오차 방지
    // 계산 순서: (시간 * 시급) * 0.9 또는 (시간 * 시급)
    // Math.round() 전에 정확한 값 확인
    const probationPayRaw = probationHours * salaryAmount * 0.9;
    const regularPayRaw = regularHours * salaryAmount;
    
    // 🔥 디버깅 로그
    console.log('🔥 수습급여 계산:', {
      employeeName: this.employee.name,
      probationHours,
      regularHours,
      salaryAmount,
      probationPayRaw,
      regularPayRaw,
      probationPayCalculated: Math.round(probationPayRaw),
      regularPayCalculated: Math.round(regularPayRaw)
    });
    
    // 🔥 정확한 반올림: 부동소수점 오차 보정
    const probationPay = Math.round(Math.round(probationPayRaw * 100) / 100);
    const regularPay = Math.round(Math.round(regularPayRaw * 100) / 100);
    const basePay = probationPay + regularPay;
    
    // 4. 주휴수당 계산
    const { weeklyHolidayPay, weeklyHolidayHours, weeklyHolidayDetails } = this.calculateWeeklyHolidayPay();
    
    // 5. 총 지급액
    const grossPay = basePay + weeklyHolidayPay;
    
    // 6. 4대보험 및 소득세 공제
    const deductions = this.calculateLaborIncomeDeductions(grossPay);
    
    // 편집 가능한 공제항목 초기화
    deductions.editableDeductions = {
      nationalPension: deductions.insuranceDetails?.nationalPension || 0,
      healthInsurance: deductions.insuranceDetails?.healthInsurance || 0,
      longTermCare: deductions.insuranceDetails?.longTermCare || 0,
      employmentInsurance: deductions.insuranceDetails?.employmentInsurance || 0,
      incomeTax: deductions.taxDetails?.incomeTax || 0,
      localIncomeTax: deductions.taxDetails?.localIncomeTax || 0
    };
    
    // 7. 실수령액
    const netPay = grossPay - deductions.total;
    
    // 8. 지점별 근무시간
    const branches = this.calculateBranchHours();
    
    return {
      employeeId: this.employee.id,
      employeeName: this.employee.name,
      employmentType: this.contract.employmentType,
      salaryType: this.contract.salaryType,
      salaryAmount: salaryAmount,
      totalWorkHours,
      totalBreakTime,
      actualWorkHours,
      grossPay,
      deductions,
      netPay,
      branches,
      probationHours,
      regularHours,
      probationPay,
      regularPay,
      weeklyHolidayPay,
      weeklyHolidayHours,
      includesWeeklyHolidayInWage: this.employee.includesWeeklyHolidayInWage,
      weeklyHolidayDetails,
      unpaidLeaveDays: 0,
      unpaidLeaveDeduction: 0
    };
  }

  // 🔥 2-1. 근로소득자 일급제 계산
  private calculateLaborIncomeDaily(): PayrollResult {
    console.log('🔥 근로소득자 일급제 계산 시작');
    
    // 1. 근무시간 계산
    const { totalWorkHours, totalBreakTime, actualWorkHours } = this.calculateWorkHours();
    
    // 2. 일급 계산: 실제 나온 날 수 × 일급 금액
    const dailyWage = this.contract.salaryAmount || 0;
    const workDays = this.calculateWorkDays();
    
    // 3. 수습기간 구분
    const { probationDays, regularDays } = this.separateProbationDays();
    
    console.log('🔥 근로소득 일급 계산:', {
      employeeName: this.employee.name,
      dailyWage,
      totalWorkDays: workDays,
      probationDays,
      regularDays
    });
    
    // 4. 기본급 계산 (수습기간 90% 적용)
    const probationPay = probationDays > 0 ? Math.round(probationDays * dailyWage * 0.9) : 0;
    const regularPay = regularDays > 0 ? Math.round(regularDays * dailyWage) : 0;
    const basePay = probationPay + regularPay;
    
    // 5. 4대보험 및 소득세 공제
    const deductions = this.calculateLaborIncomeDeductions(basePay);
    
    // 편집 가능한 공제항목 초기화
    deductions.editableDeductions = {
      nationalPension: deductions.insuranceDetails?.nationalPension || 0,
      healthInsurance: deductions.insuranceDetails?.healthInsurance || 0,
      longTermCare: deductions.insuranceDetails?.longTermCare || 0,
      employmentInsurance: deductions.insuranceDetails?.employmentInsurance || 0,
      incomeTax: deductions.taxDetails?.incomeTax || 0,
      localIncomeTax: deductions.taxDetails?.localIncomeTax || 0
    };
    
    // 6. 실수령액
    const netPay = basePay - deductions.total;
    
    // 7. 지점별 근무시간
    const branches = this.calculateBranchHours();
    
    return {
      employeeId: this.employee.id,
      employeeName: this.employee.name,
      employmentType: this.contract.employmentType,
      salaryType: this.contract.salaryType,
      salaryAmount: dailyWage,
      totalWorkHours,
      totalBreakTime,
      actualWorkHours,
      grossPay: basePay,
      deductions,
      netPay,
      branches,
      probationHours: 0, // 일급제는 시간이 아니라 일수로 계산
      regularHours: 0,
      probationDays, // 일급제용 수습 일수
      regularDays, // 일급제용 정규 일수
      probationPay,
      regularPay,
      weeklyHolidayPay: 0,
      weeklyHolidayHours: 0,
      includesWeeklyHolidayInWage: this.employee.includesWeeklyHolidayInWage,
      weeklyHolidayDetails: [],
      unpaidLeaveDays: 0,
      unpaidLeaveDeduction: 0
    };
  }

  // 🔥 2-2. 근로소득자 월급제 계산
  private calculateLaborIncomeMonthly(): PayrollResult {
    console.log('🔥 근로소득자 월급제 계산 시작');
    
    // 1. 근무시간 계산
    const { totalWorkHours, totalBreakTime, actualWorkHours } = this.calculateWorkHours();
    
    const salaryAmount = this.contract.salaryAmount || 0;
    const { probationHours, regularHours } = this.separateProbationHours();
    const totalHours = probationHours + regularHours;

    let probationPay = 0;
    let regularPay = 0;
    let grossPay = salaryAmount;

    if (salaryAmount > 0) {
      if (totalHours > 0) {
        const probationRatio = probationHours / totalHours;
        const regularRatio = regularHours / totalHours;

        probationPay = Math.round(salaryAmount * probationRatio * 0.9);
        regularPay = Math.round(salaryAmount * regularRatio);
        grossPay = probationPay + regularPay;

        // 라운딩 오차 조정 (정규급여에 반영)
        const roundingGap = Math.round(salaryAmount * (probationRatio * 0.9 + regularRatio)) - grossPay;
        if (roundingGap !== 0) {
          regularPay += roundingGap;
          grossPay += roundingGap;
        }
      } else {
        const isMonthInProbation = this.isMonthInProbation();
        grossPay = isMonthInProbation ? Math.round(salaryAmount * 0.9) : salaryAmount;
        if (isMonthInProbation) {
          probationPay = grossPay;
        } else {
          regularPay = grossPay;
        }
      }
    }
 
    // 3. 4대보험 및 소득세 공제
    const deductions = this.calculateLaborIncomeDeductions(grossPay);
    
    // 편집 가능한 공제항목 초기화
    deductions.editableDeductions = {
      nationalPension: deductions.insuranceDetails?.nationalPension || 0,
      healthInsurance: deductions.insuranceDetails?.healthInsurance || 0,
      longTermCare: deductions.insuranceDetails?.longTermCare || 0,
      employmentInsurance: deductions.insuranceDetails?.employmentInsurance || 0,
      incomeTax: deductions.taxDetails?.incomeTax || 0,
      localIncomeTax: deductions.taxDetails?.localIncomeTax || 0
    };
    
    // 4. 실수령액
    const netPay = grossPay - deductions.total;
    
    // 5. 지점별 근무시간
    const branches = this.calculateBranchHours();
    
    return {
      employeeId: this.employee.id,
      employeeName: this.employee.name,
      employmentType: this.contract.employmentType,
      salaryType: this.contract.salaryType,
      salaryAmount: salaryAmount,
      totalWorkHours,
      totalBreakTime,
      actualWorkHours,
      grossPay,
      deductions,
      netPay,
      branches,
      probationHours,
      regularHours,
      probationPay,
      regularPay,
      weeklyHolidayPay: 0,
      weeklyHolidayHours: 0,
      includesWeeklyHolidayInWage: this.employee.includesWeeklyHolidayInWage,
      weeklyHolidayDetails: [],
      unpaidLeaveDays: 0,
      unpaidLeaveDeduction: 0
    };
  }

  // 🔥 3. 사업소득자 계산
  private calculateBusinessIncome(): PayrollResult {
    console.log('🔥 사업소득자 계산 시작');
    
    // 1. 근무시간 계산
    const { totalWorkHours, totalBreakTime, actualWorkHours } = this.calculateWorkHours();
    
    // 2. 수습기간 구분
    const { probationHours, regularHours } = this.separateProbationHours();
    
    // 3. 기본급 계산
    let basePay = 0;
    let probationPay = 0;
    let regularPay = 0;
    let probationDays: number | undefined = undefined;
    let regularDays: number | undefined = undefined;
    
    if (this.contract.salaryType === 'daily' || this.contract.salaryType === '일급') {
      // 일급 계산: 실제 나온 날 수 × 일급 금액
      const dailyWage = this.contract.salaryAmount;
      const workDays = this.calculateWorkDays();
      
      // 수습기간 구분
      const daysResult = this.separateProbationDays();
      probationDays = daysResult.probationDays;
      regularDays = daysResult.regularDays;
      
      console.log('🔥 사업소득 일급 계산:', {
        employeeName: this.employee.name,
        dailyWage,
        totalWorkDays: workDays,
        probationDays,
        regularDays
      });
      
      probationPay = probationDays > 0 ? Math.round(probationDays * dailyWage * 0.9) : 0;
      regularPay = regularDays > 0 ? Math.round(regularDays * dailyWage) : 0;
      basePay = probationPay + regularPay;
    } else if (this.contract.salaryType === 'hourly' || this.contract.salaryType === '시급') {
      const salaryAmount = this.contract.salaryAmount;
      
      // 🔥 정확한 계산을 위해 부동소수점 오차 방지
      const probationPayRaw = probationHours * salaryAmount * 0.9;
      const regularPayRaw = regularHours * salaryAmount;
      
      // 🔥 디버깅 로그
      console.log('🔥 사업소득 수습급여 계산:', {
        employeeName: this.employee.name,
        probationHours,
        regularHours,
        salaryAmount,
        probationPayRaw,
        regularPayRaw
      });
      
      probationPay = Math.round(Math.round(probationPayRaw * 100) / 100);
      regularPay = Math.round(Math.round(regularPayRaw * 100) / 100);
      basePay = probationPay + regularPay;
    } else {
      const salaryAmount = this.contract.salaryAmount || 0;
      const totalHours = probationHours + regularHours;
      if (salaryAmount > 0 && totalHours > 0) {
        const probationRatio = probationHours / totalHours;
        const regularRatio = regularHours / totalHours;

        probationPay = Math.round(salaryAmount * probationRatio * 0.9);
        regularPay = Math.round(salaryAmount * regularRatio);
        basePay = probationPay + regularPay;

        const roundingGap = Math.round(salaryAmount * (probationRatio * 0.9 + regularRatio)) - basePay;
        if (roundingGap !== 0) {
          regularPay += roundingGap;
          basePay += roundingGap;
        }
      } else {
        basePay = this.isMonthInProbation() ? Math.round(salaryAmount * 0.9) : salaryAmount;
        if (this.isMonthInProbation()) {
          probationPay = basePay;
        } else {
          regularPay = basePay;
        }
      }
    }
    
    // 4. 주휴수당 계산 (시급제만)
    let weeklyHolidayPay = 0;
    let weeklyHolidayHours = 0;
    let weeklyHolidayDetails: Array<{
      weekStart: string;
      weekEnd: string;
      hours: number;
      pay: number;
      eligible: boolean;
      reason?: string;
    }> = [];
    
    if (this.contract.salaryType === 'hourly' || this.contract.salaryType === '시급') {
      const result = this.calculateWeeklyHolidayPay();
      weeklyHolidayPay = result.weeklyHolidayPay;
      weeklyHolidayHours = result.weeklyHolidayHours;
      weeklyHolidayDetails = result.weeklyHolidayDetails;
    }
    
    // 5. 총 지급액
    const grossPay = basePay + weeklyHolidayPay;
    
    // 6. 사업소득세 공제 (3.3%)
    const tax = Math.round(grossPay * 0.033);
    const deductions = {
      insurance: 0,
      tax,
      total: tax
    };
    
    // 7. 실수령액
    const netPay = grossPay - deductions.total;
    
    // 8. 지점별 근무시간
    const branches = this.calculateBranchHours();
    
    return {
      employeeId: this.employee.id,
      employeeName: this.employee.name,
      employmentType: this.contract.employmentType,
      salaryType: this.contract.salaryType,
      salaryAmount: this.contract.salaryAmount,
      totalWorkHours,
      totalBreakTime,
      actualWorkHours,
      grossPay,
      deductions,
      netPay,
      branches,
      probationHours,
      regularHours,
      probationDays,
      regularDays,
      probationPay,
      regularPay,
      weeklyHolidayPay,
      weeklyHolidayHours,
      includesWeeklyHolidayInWage: this.employee.includesWeeklyHolidayInWage,
      weeklyHolidayDetails,
      unpaidLeaveDays: 0,
      unpaidLeaveDeduction: 0
    };
  }

  // 🔥 4. 외국인 계산 (사업소득자와 동일하지만 별도 처리)
  private calculateForeigner(): PayrollResult {
    console.log('🔥 외국인 계산 시작');
    
    // 사업소득자와 동일한 로직 사용
    const result = this.calculateBusinessIncome();
    
    // 외국인 특별 처리 (필요시 추가)
    result.employmentType = '외국인';
    
    return result;
  }

  // 🔥 5. 일용직 계산 (세금 없음)
  private calculateDailyWorker(): PayrollResult {
    console.log('🔥 일용직 계산 시작');
    
    // 1. 근무시간 계산
    const { totalWorkHours, totalBreakTime, actualWorkHours } = this.calculateWorkHours();
    
    // 2. 수습기간 구분
    const { probationHours, regularHours } = this.separateProbationHours();
    
    // 3. 기본급 계산 (시급제만)
    const salaryAmount = this.contract.salaryAmount;
    
    // 🔥 정확한 계산을 위해 부동소수점 오차 방지
    const probationPayRaw = probationHours * salaryAmount * 0.9;
    const regularPayRaw = regularHours * salaryAmount;
    
    // 🔥 디버깅 로그
    console.log('🔥 일용직 수습급여 계산:', {
      employeeName: this.employee.name,
      probationHours,
      regularHours,
      salaryAmount,
      probationPayRaw,
      regularPayRaw
    });
    
    const probationPay = Math.round(Math.round(probationPayRaw * 100) / 100);
    const regularPay = Math.round(Math.round(regularPayRaw * 100) / 100);
    const basePay = probationPay + regularPay;
    
    // 4. 총 지급액 (세금 없음)
    const grossPay = basePay;
    
    // 5. 공제 없음
    const deductions = {
      insurance: 0,
      tax: 0,
      total: 0
    };
    
    // 6. 실수령액
    const netPay = grossPay;
    
    // 7. 지점별 근무시간
    const branches = this.calculateBranchHours();
    
    return {
      employeeId: this.employee.id,
      employeeName: this.employee.name,
      employmentType: this.contract.employmentType,
      salaryType: this.contract.salaryType,
      salaryAmount: salaryAmount,
      totalWorkHours,
      totalBreakTime,
      actualWorkHours,
      grossPay,
      deductions,
      netPay,
      branches,
      probationHours,
      regularHours,
      probationPay,
      regularPay,
      weeklyHolidayPay: 0,
      weeklyHolidayHours: 0,
      includesWeeklyHolidayInWage: this.employee.includesWeeklyHolidayInWage,
      weeklyHolidayDetails: [],
      unpaidLeaveDays: 0,
      unpaidLeaveDeduction: 0
    };
  }

  // 🔥 공통 함수들
  private calculateWorkHours(): { totalWorkHours: number; totalBreakTime: number; actualWorkHours: number } {
    const totalWorkHours = this.schedules.reduce((sum, s) => sum + s.actualWorkHours, 0);
    const totalBreakTime = 0; // 현재는 breakTime을 별도로 관리하지 않음
    const actualWorkHours = totalWorkHours;

    return { totalWorkHours, totalBreakTime, actualWorkHours };
  }

  // 🔥 수습기간 구분
  private separateProbationHours(): { probationHours: number; regularHours: number } {
    let probationHours = 0;
    let regularHours = 0;

    if (!this.employee.probationStartDate || !this.employee.probationEndDate) {
      // 수습기간이 없으면 모든 시간이 정규 시간
      regularHours = this.calculateWorkHours().actualWorkHours;
      return { probationHours, regularHours };
    }

    const probationStartOnly = new Date(this.employee.probationStartDate!.toISOString().split('T')[0]);
    const probationEndOnly = new Date(this.employee.probationEndDate!.toISOString().split('T')[0]);
    
    console.log('🔥 separateProbationHours 시작:', {
      employeeName: this.employee.name,
      probationStartDate: probationStartOnly.toISOString().split('T')[0],
      probationEndDate: probationEndOnly.toISOString().split('T')[0],
      schedulesCount: this.schedules.length
    });

    // 수습기간 판단
    this.schedules.forEach((schedule, index) => {
      const scheduleDateOnly = new Date(schedule.date.toISOString().split('T')[0]);
      
      const isInProbation = scheduleDateOnly >= probationStartOnly && scheduleDateOnly <= probationEndOnly;
      
      if (isInProbation) {
        probationHours += schedule.actualWorkHours;
        console.log(`🔥 수습시간 추가 [${index}]: ${scheduleDateOnly.toISOString().split('T')[0]}, ${schedule.actualWorkHours}시간 (누적: ${probationHours}시간)`);
      } else {
        regularHours += schedule.actualWorkHours;
        console.log(`🔥 정규시간 추가 [${index}]: ${scheduleDateOnly.toISOString().split('T')[0]}, ${schedule.actualWorkHours}시간 (누적: ${regularHours}시간)`);
      }
    });

    console.log('🔥 separateProbationHours 결과:', {
      probationHours,
      regularHours,
      total: probationHours + regularHours
    });

    return { probationHours, regularHours };
  }

  // 🔥 실제 근무 일수 계산 (일급 계산용)
  private calculateWorkDays(): number {
    // actualWorkHours > 0인 날짜의 개수
    return this.schedules.filter(schedule => schedule.actualWorkHours > 0).length;
  }

  // 🔥 수습기간별 일수 구분 (일급 계산용)
  private separateProbationDays(): { probationDays: number; regularDays: number } {
    let probationDays = 0;
    let regularDays = 0;

    if (!this.employee.probationStartDate || !this.employee.probationEndDate) {
      // 수습기간이 없으면 모든 일수가 정규 일수
      regularDays = this.calculateWorkDays();
      return { probationDays, regularDays };
    }

    // 수습기간 판단 (actualWorkHours > 0인 날짜만)
    this.schedules.forEach(schedule => {
      if (schedule.actualWorkHours <= 0) return; // 근무하지 않은 날은 제외
      
      const scheduleDateOnly = new Date(schedule.date.toISOString().split('T')[0]);
      const probationStartOnly = new Date(this.employee.probationStartDate!.toISOString().split('T')[0]);
      const probationEndOnly = new Date(this.employee.probationEndDate!.toISOString().split('T')[0]);
      
      const isInProbation = scheduleDateOnly >= probationStartOnly && scheduleDateOnly <= probationEndOnly;
      
      if (isInProbation) {
        probationDays += 1;
      } else {
        regularDays += 1;
      }
    });

    return { probationDays, regularDays };
  }

  // 🔥 근로소득자 4대보험 및 소득세 계산
  private calculateLaborIncomeDeductions(grossPay: number): {
    insurance: number;
    tax: number;
    total: number;
    insuranceDetails?: {
      nationalPension: number;
      healthInsurance: number;
      longTermCare: number;
      employmentInsurance: number;
    };
    taxDetails?: {
      incomeTax: number;
      localIncomeTax: number;
    };
    editableDeductions?: {
      nationalPension: number;
      healthInsurance: number;
      longTermCare: number;
      employmentInsurance: number;
      incomeTax: number;
      localIncomeTax: number;
    };
  } {
    // 4대보험 계산 (2025년 기준)
    const nationalPension = Math.round(grossPay * 0.045);      // 국민연금 4.5%
    const healthInsurance = Math.round(grossPay * 0.03545);    // 건강보험 3.545%
    const longTermCare = Math.round(healthInsurance * 0.1295); // 장기요양보험 (건강보험의 12.95%)
    const employmentInsurance = Math.round(grossPay * 0.009);  // 고용보험 0.9%
    
    const insurance = nationalPension + healthInsurance + longTermCare + employmentInsurance;
    const insuranceDetails = {
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance
    };

    // 소득세 간이세액표 적용 (부양가족 1명 기준)
    let incomeTax = 0;
    if (grossPay <= 1060000) {
      incomeTax = 0;
    } else if (grossPay <= 2100000) {
      incomeTax = Math.round((grossPay - 1060000) * 0.02);
    } else if (grossPay <= 3160000) {
      incomeTax = Math.round(20800 + (grossPay - 2100000) * 0.04);
    } else if (grossPay <= 5000000) {
      incomeTax = Math.round(63200 + (grossPay - 3160000) * 0.06);
    } else {
      incomeTax = Math.round(173600 + (grossPay - 5000000) * 0.08);
    }
    
    const localIncomeTax = Math.round(incomeTax * 0.1); // 지방소득세 (소득세의 10%)
    const tax = incomeTax + localIncomeTax;
    const taxDetails = {
      incomeTax,
      localIncomeTax
    };

    return {
      insurance,
      tax,
      total: insurance + tax,
      insuranceDetails,
      taxDetails
    };
  }

  // 🔥 월이 수습기간에 포함되는지 확인
  private isMonthInProbation(): boolean {
    console.log('🔥 수습기간 확인 시작:', {
      probationStartDate: this.employee.probationStartDate,
      probationEndDate: this.employee.probationEndDate,
      employeeName: this.employee.name
    });
    
    if (!this.employee.probationStartDate || !this.employee.probationEndDate) {
      console.log('🔥 수습기간 데이터 없음');
      return false;
    }

    // 현재 계산 중인 월 (첫 번째 스케줄의 월 기준)
    if (this.schedules.length === 0) {
      console.log('🔥 스케줄 데이터 없음');
      return false;
    }
    
    const firstSchedule = this.schedules[0];
    const monthDate = new Date(firstSchedule.date.getFullYear(), firstSchedule.date.getMonth(), 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const probationStart = this.employee.probationStartDate;
    const probationEnd = this.employee.probationEndDate;
    
    console.log('🔥 수습기간 계산:', {
      monthStart: monthStart,
      monthEnd: monthEnd,
      probationStart: probationStart,
      probationEnd: probationEnd,
      isInProbation: monthStart <= probationEnd && monthEnd >= probationStart
    });

    // 월의 시작일 또는 종료일이 수습기간에 포함되면 수습기간으로 판단
    return (monthStart >= probationStart && monthStart <= probationEnd) ||
           (monthEnd >= probationStart && monthEnd <= probationEnd) ||
           (monthStart <= probationStart && monthEnd >= probationEnd);
  }

  // 🔥 주휴수당 계산
  private calculateWeeklyHolidayPay(): { 
    weeklyHolidayPay: number; 
    weeklyHolidayHours: number; 
    weeklyHolidayDetails: Array<{
      weekStart: string;
      weekEnd: string;
      hours: number;
      pay: number;
      eligible: boolean;
      reason?: string;
    }>;
  } {
    // 주휴수당 조건 확인
    const shouldCalculateWeeklyHoliday = 
      (this.employee.employmentType === '근로소득' || 
       this.employee.employmentType === '사업소득' || 
       this.employee.employmentType === '외국인') &&
      (this.contract.salaryType === 'hourly' || this.contract.salaryType === '시급') &&
      !this.employee.includesWeeklyHolidayInWage;

    if (!shouldCalculateWeeklyHoliday) {
      return { weeklyHolidayPay: 0, weeklyHolidayHours: 0, weeklyHolidayDetails: [] };
    }

    // 🔥 선택된 월의 시작일과 종료일 계산 (스케줄의 첫 번째 날짜 기준)
    if (this.schedules.length === 0) {
      return { weeklyHolidayPay: 0, weeklyHolidayHours: 0, weeklyHolidayDetails: [] };
    }
    const firstSchedule = this.schedules[0];
    const monthDate = new Date(firstSchedule.date.getFullYear(), firstSchedule.date.getMonth(), 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    // 주차별로 그룹화
    const weeklyGroups = this.groupSchedulesByWeek();
    let totalWeeklyHolidayPay = 0;
    let totalWeeklyHolidayHours = 0;
    const weeklyHolidayDetails: Array<{
      weekStart: string;
      weekEnd: string;
      hours: number;
      pay: number;
      eligible: boolean;
      reason?: string;
    }> = [];

    weeklyGroups.forEach(week => {
      // 🔥 해당 주가 선택된 월과 겹치는지 확인
      const sortedWeek = [...week].sort((a, b) => a.date.getTime() - b.date.getTime());
      const weekStartDate = sortedWeek[0].date;
      const weekEndDate = sortedWeek[sortedWeek.length - 1].date;
      
      // 주의 월요일 계산
      const monday = new Date(weekStartDate);
      const dayOfWeek = monday.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      monday.setDate(monday.getDate() + mondayOffset);
      // 주의 일요일 계산
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      // 해당 주의 일부라도 선택된 월에 포함되면 계산
      const weekOverlapsMonth = (monday <= monthEnd && sunday >= monthStart);
      
      if (!weekOverlapsMonth) {
        console.log('🔥 주차 제외 (월 범위 밖):', monday.toISOString().split('T')[0], '~', sunday.toISOString().split('T')[0]);
        return; // 이 주차는 제외
      }

      const weeklyHolidayResult = this.calculateWeeklyHolidayForWeek(week, monthStart, monthEnd);
      totalWeeklyHolidayPay += weeklyHolidayResult.pay;
      totalWeeklyHolidayHours += weeklyHolidayResult.hours;
      weeklyHolidayDetails.push(weeklyHolidayResult);
    });

    return {
      weeklyHolidayPay: totalWeeklyHolidayPay,
      weeklyHolidayHours: totalWeeklyHolidayHours,
      weeklyHolidayDetails
    };
  }

  // 🔥 스케줄을 주차별로 그룹화 (월요일~일요일 기준)
  private groupSchedulesByWeek(): Schedule[][] {
    const weeklyGroups: { [key: string]: Schedule[] } = {};

    this.schedules.forEach(schedule => {
      // 해당 주의 월요일(주 시작) 찾기
      const monday = new Date(schedule.date);
      const dayOfWeek = monday.getDay(); // 0=일, 1=월, 6=토
      // 일요일(0)인 경우 -6, 월요일(1)인 경우 -1, ... 토요일(6)인 경우 1
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      monday.setDate(monday.getDate() + mondayOffset);

      const weekKey = monday.toISOString().split('T')[0];
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = [];
      }
      weeklyGroups[weekKey].push(schedule);
    });

    return Object.values(weeklyGroups);
  }

  // 🔥 특정 주의 주휴수당 계산
  private calculateWeeklyHolidayForWeek(weekSchedules: Schedule[], monthStart?: Date, monthEnd?: Date): {
    weekStart: string;
    weekEnd: string;
    hours: number;
    pay: number;
    eligible: boolean;
    reason?: string;
  } {
    const salaryAmount = this.contract.salaryAmount;
    const weeklyWorkdays = 5; // 기본값 (주 5일 기준)

    // 해당 주의 총 근무시간 (현재 달에 포함된 부분만)
    const totalHours = weekSchedules.reduce((sum, s) => sum + s.actualWorkHours, 0);

    // 날짜 순으로 정렬 후 주차 경계(월~일) 계산
    const sortedSchedules = [...weekSchedules].sort((a, b) => a.date.getTime() - b.date.getTime());
    const anchor = sortedSchedules[0]?.date || new Date();
    const startMonday = new Date(anchor);
    const dayOfWeek = startMonday.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startMonday.setDate(startMonday.getDate() + mondayOffset); // 이전(또는 당일) 월요일
    const endSunday = new Date(startMonday);
    endSunday.setDate(startMonday.getDate() + 6); // 일요일
    const weekStart = startMonday.toISOString().split('T')[0];
    const weekEnd = endSunday.toISOString().split('T')[0];

    // 🔥 전월 이월 주 보정 로직 (실제 근무시간 기반)
    // - 해당 주의 월요일이 선택된 월 이전에 있고
    // - 해당 주의 일요일이 선택된 월에 포함되는 경우
    //   → "전월 이월 주"로 간주하고, 이전달에 속한 나머지 일자(예: 1/26~1/31)의
    //      실제 근무시간을 prevWeekHoursMap에서 가져와 합산하여 15시간 요건과 주휴시간을 계산
    let carriedOverFromPrevMonth = false;
    let prevMonthHours = 0;
    let combinedTotalHours = totalHours;

    if (monthStart) {
      const isCrossingFromPrevMonth =
        startMonday < monthStart && endSunday >= monthStart;

      if (isCrossingFromPrevMonth) {
        // PayrollCalculator 생성 시 전달된 이전달 부분 주의 근무시간(예: 1/26~1/31)을 가져옴
        prevMonthHours = this.prevWeekHoursMap?.[weekStart] || 0;

        if (prevMonthHours > 0) {
          carriedOverFromPrevMonth = true;
          combinedTotalHours = totalHours + prevMonthHours;
        }
      }
    }

    // 주휴수당 계산 (기본: 해당 주 실제 근무시간 + 이전달 부분을 모두 합산한 시간 기준 15시간 요건)
    let eligible = false;
    let hours = 0;
    let pay = 0;

    if (combinedTotalHours >= 15) {
      eligible = true;
      hours = combinedTotalHours / weeklyWorkdays; // 주 전체 근무시간 ÷ 주간 근무일수
      pay = Math.round(hours * salaryAmount);
    }

    // 마지막 주인지 확인 (다음달로 이월되는 주)
    // 🔥 주의 일요일이 선택된 월의 마지막 날보다 이후인 경우만 이월
    const isLastWeek = monthEnd ? endSunday > monthEnd : this.isLastWeekOfMonth_SunEnd(weekSchedules);
    // 🔥 주의 일요일이 선택된 월의 마지막 날과 같으면 이번 달에 포함
    const isLastWeekEndingOnSunday = monthEnd ? endSunday.getTime() === monthEnd.getTime() : this.isLastWeekEndingOnSunday(weekSchedules);

    // 🔥 디버깅 로그 추가
    console.log('🔥 주휴수당 계산:', {
      employeeName: this.employee.name,
      weekStart,
      weekEnd,
      totalHours,
      combinedTotalHours,
      prevMonthHours,
      workedAllScheduledDays,
      scheduleCount: weekSchedules.length,
      weeklyWorkdays,
      salaryAmount,
      eligible,
      isLastWeek,
      isLastWeekEndingOnSunday
    });

    // 주휴수당 지급 조건 (월~일 기준)
    // 1) 15시간 이상 + 마지막 주가 아니면 지급
    // 2) 15시간 이상 + 마지막 주이지만 일요일로 끝나면 지급
    // 3) 마지막 주이고 일요일로 끝나지 않으면 다음달로 이월
    const finalEligible = eligible && !(isLastWeek && !isLastWeekEndingOnSunday);
    const finalHours = finalEligible ? hours : 0;
    const finalPay = finalEligible ? pay : 0;

    let reason: string | undefined;
    if (!finalEligible) {
      reason = (isLastWeek && !isLastWeekEndingOnSunday)
        ? '다음달로 이월하여 합산'
        : '근무시간 부족 또는 출근일 부족';
    } else if (carriedOverFromPrevMonth) {
      reason = '지급 (전월 이월 주 합산)';
    }

    return {
      weekStart,
      weekEnd,
      hours: finalHours,
      pay: finalPay,
      eligible: finalEligible,
      reason
    };
  }

  // 🔥 해당 주가 월의 마지막 주인지 확인 (월~일 기준, 다음달로 이월되는 주)
  private isLastWeekOfMonth_SunEnd(weekSchedules: Schedule[]): boolean {
    if (weekSchedules.length === 0) return false;
    
    // 해당 주의 첫 번째 날짜 찾기
    const sortedSchedules = [...weekSchedules].sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstDate = sortedSchedules[0].date;
    
    // 해당 월의 마지막 날 계산
    const month = firstDate.getMonth();
    const year = firstDate.getFullYear();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // 해당 주의 일요일 계산 (해당 주의 마지막 날)
    const sunday = new Date(firstDate);
    const dayOfWeek = sunday.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    sunday.setDate(firstDate.getDate() + mondayOffset + 6); // 월요일 + 6 = 일요일

    // 해당 주의 일요일이 해당 월의 마지막 날과 같거나 이후이면 마지막 주
    return sunday >= lastDayOfMonth;
  }

  // 🔥 해당 주가 일요일로 끝나는 마지막 주인지 확인 (월~일 기준)
  private isLastWeekEndingOnSunday(weekSchedules: Schedule[]): boolean {
    if (weekSchedules.length === 0) return false;
    
    // 해당 주의 마지막 날짜 찾기
    const sortedSchedules = [...weekSchedules].sort((a, b) => a.date.getTime() - b.date.getTime());
    const lastDate = sortedSchedules[sortedSchedules.length - 1].date;
    
    // 해당 월의 마지막 날 계산
    const month = lastDate.getMonth();
    const year = lastDate.getFullYear();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // 해당 주의 일요일 계산
    const sunday = new Date(lastDate);
    const dayOfWeek = sunday.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    sunday.setDate(lastDate.getDate() + mondayOffset + 6); // 월요일 + 6 = 일요일

    // 해당 주의 일요일이 해당 월의 마지막 날인지 확인
    return sunday.getTime() === lastDayOfMonth.getTime();
  }

  // 🔥 지점별 근무시간 계산
  private calculateBranchHours(): { branchId: string; branchName: string; workHours: number }[] {
    const branchMap = new Map<string, { branchName: string; workHours: number }>();

    this.schedules.forEach(schedule => {
      const existing = branchMap.get(schedule.branchId);
      if (existing) {
        existing.workHours += schedule.actualWorkHours;
      } else {
        branchMap.set(schedule.branchId, {
          branchName: schedule.branchName,
          workHours: schedule.actualWorkHours
        });
      }
    });

    return Array.from(branchMap.entries()).map(([branchId, data]) => ({
      branchId,
      branchName: data.branchName,
      workHours: data.workHours
    }));
  }
}
