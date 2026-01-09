'use client';

import React, { useState, useEffect, use } from 'react';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useSearchParams } from 'next/navigation';

// ?대씪?댁뼵???ъ씠?쒖뿉?쒕쭔 ?ㅽ뻾?섎뒗吏 ?뺤씤 - 利됱떆 ?ㅽ뻾 (媛??理쒖긽??
if (typeof window !== 'undefined') {
  // 媛???뺤떎??諛⑸쾿: alert ?ъ슜
  console.error('?뵶?뵶?뵶 ?섏씠吏 ?뚯씪 濡쒕뱶??- ?닿쾬??蹂댁씠硫?JavaScript???ㅽ뻾 以??뵶?뵶?뵶');
  console.error('?뵶 ?꾩옱 URL:', window.location.href);
  // alert瑜?二쇱꽍 泥섎━?섏? 留먭퀬 ?쇰떒 ?뺤씤?⑹쑝濡??ъ슜
  // alert('?섏씠吏 ?뚯씪 濡쒕뱶?? ' + window.location.href);
}

interface Employee {
  id: string;
  name: string;
  residentNumber?: string;
  email?: string;
}

interface ConfirmedPayroll {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  calculations: any[];
  totalGrossPay?: number;
  totalDeductions?: number;
  totalNetPay?: number;
}

interface WorkTimeComparisonResult {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  month: string;
  date: string;
  actualWorkHours?: number;
  actualTimeRange?: string;
  posTimeRange?: string;
  actualBreakTime?: number;
}

interface PublicPayrollPageProps {
  params: Promise<{
    employeeId: string;
  }>;
}

export default function PublicPayrollPage({ params }: PublicPayrollPageProps) {
  // 利됱떆 ?ㅽ뻾?섎뒗 濡쒓렇 (?섏씠吏 理쒖긽?? - console.error ?ъ슜 (???뺤떎??
  console.error('?윟?윟?윟 PublicPayrollPage 而댄룷?뚰듃 ?⑥닔 ?쒖옉 ?윟?윟?윟');
  
  if (typeof window !== 'undefined') {
    console.error('?윟 window 媛앹껜 議댁옱, ?꾩옱 URL:', window.location.href);
    console.error('?윟 ?꾩옱 寃쎈줈:', window.location.pathname);
    console.error('?윟 ?꾩옱 荑쇰━:', window.location.search);
  } else {
    console.error('?좑툘 window 媛앹껜 ?놁쓬 - ?쒕쾭 ?ъ씠???뚮뜑留?');
  }

  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  
  console.error('?윟 resolvedParams, searchParams 珥덇린???꾨즺');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payroll, setPayroll] = useState<ConfirmedPayroll | null>(null);
  const [workTimeComparisons, setWorkTimeComparisons] = useState<WorkTimeComparisonResult[]>([]);
  const [branches, setBranches] = useState<{id: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 而댄룷?뚰듃 留덉슫???뺤씤
  useEffect(() => {
    console.error('?????? PublicPayrollPage useEffect ?ㅽ뻾????????');
    console.error('?? resolvedParams:', resolvedParams);
    try {
      console.log('?? employeeId:', resolvedParams?.employeeId);
    } catch (e) {
      console.error('?? employeeId ?묎렐 ?ㅻ쪟:', e);
    }
    try {
      console.log('?? searchParams:', searchParams?.toString());
      console.log('?? token:', searchParams?.get('t'));
    } catch (e) {
      console.error('?? searchParams ?묎렐 ?ㅻ쪟:', e);
    }
    return () => {
      console.log('?뵶 PublicPayrollPage 而댄룷?뚰듃 ?몃쭏?댄듃??);
    };
  }, [resolvedParams, searchParams]);

  // ?좏겙?먯꽌 ???뺣낫 異붿텧 (媛꾨떒??base64 ?붿퐫??
  const getMonthFromToken = (token: string): string | null => {
    try {
      const decoded = atob(token);
      const data = JSON.parse(decoded);
      return data.month || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    console.error('?뵷 useEffect (loadData) ?ㅽ뻾??);
    console.error('?뵷 resolvedParams:', resolvedParams);
    
    const loadData = async () => {
      try {
        console.error('?뵷 loadData ?⑥닔 ?쒖옉');
        setLoading(true);
        setError(null);

        const employeeId = resolvedParams.employeeId;
        const token = searchParams.get('t');

        console.error('?뵇 怨듭쑀 留곹겕 ?묎렐:', { employeeId, token });
        console.error('?뵇 typeof employeeId:', typeof employeeId);
        console.error('?뵇 employeeId 媛?', employeeId);

        if (!token) {
          console.error('???좏겙 ?놁쓬');
          setError('?좏슚?섏? ?딆? 留곹겕?낅땲??');
          return;
        }

        // ?좏겙?먯꽌 ???뺣낫 異붿텧
        const month = getMonthFromToken(token);
        console.log('?뱟 ?좏겙?먯꽌 異붿텧????', month);
        
        if (!month) {
          console.error('?????뺣낫 異붿텧 ?ㅽ뙣');
          setError('?좏슚?섏? ?딆? 留곹겕?낅땲??');
          return;
        }

        // 吏곸썝 ?뺣낫 濡쒕뱶 - ?щ윭 諛⑸쾿?쇰줈 ?쒕룄
        console.error('?뫀 吏곸썝 ?뺣낫 議고쉶 ?쒖옉, employeeId:', employeeId);
        let employeeDoc = await getDoc(doc(db, 'employees', employeeId));
        let actualEmployeeId = employeeId;
        
        // 諛⑸쾿 1: URL??ID媛 employee ID??寃쎌슦
        if (!employeeDoc.exists()) {
          console.error('?좑툘 employees?먯꽌 李얠? 紐삵븿, employeeId:', employeeId);
          console.error('?좑툘 confirmedPayrolls?먯꽌 ?뺤씤 ?쒕룄...');
          
          // 諛⑸쾿 2: URL??ID媛 confirmedPayrolls 臾몄꽌 ID??寃쎌슦
          try {
            const payrollDoc = await getDoc(doc(db, 'confirmedPayrolls', employeeId));
            if (payrollDoc.exists()) {
              const payrollData = payrollDoc.data();
              actualEmployeeId = payrollData.employeeId;
              console.log('??confirmedPayrolls 臾몄꽌 ID濡?李얠쓬, ?ㅼ젣 employeeId:', actualEmployeeId);
              
              // ?ㅼ젣 employeeId濡?employees 議고쉶
              employeeDoc = await getDoc(doc(db, 'employees', actualEmployeeId));
            }
          } catch (e) {
            console.error('??confirmedPayrolls 議고쉶 ?ㅽ뙣:', e);
          }
          
          // 諛⑸쾿 3: confirmedPayrolls?먯꽌 ?대떦 ?붿쓽 employeeId濡?寃??          if (!employeeDoc.exists() && month) {
            console.log('?좑툘 ?ъ쟾??李얠? 紐삵븿, ?대떦 ?붿쓽 湲됱뿬 ?곗씠?곗뿉??employeeId 李얘린...');
            try {
              const payrollQuery = query(
                collection(db, 'confirmedPayrolls'),
                where('month', '==', month)
              );
              const allPayrolls = await getDocs(payrollQuery);
              
              // URL??ID? ?쇱튂?섎뒗 臾몄꽌 李얘린
              const matchingPayroll = allPayrolls.docs.find(doc => 
                doc.id === employeeId || doc.data().employeeId === employeeId
              );
              
              if (matchingPayroll) {
                const payrollData = matchingPayroll.data();
                actualEmployeeId = payrollData.employeeId || employeeId;
                console.log('??湲됱뿬 ?곗씠?곗뿉??employeeId 李얠쓬:', actualEmployeeId);
                
                employeeDoc = await getDoc(doc(db, 'employees', actualEmployeeId));
              }
            } catch (e) {
              console.error('??湲됱뿬 ?곗씠??寃???ㅽ뙣:', e);
            }
          }
        }
        
        if (!employeeDoc.exists()) {
          // ?붾쾭源??뺣낫 ?섏쭛
          let debugInfo = [
            `??紐⑤뱺 諛⑸쾿?쇰줈 吏곸썝??李얠? 紐삵븿`,
            `議고쉶??employeeId: ${employeeId}`,
            `?쒕룄??actualEmployeeId: ${actualEmployeeId}`,
            `?? ${month}`
          ];
          
          // ?붾쾭源? employees 而щ젆?섏쓽 ?ㅼ젣 ID???뺤씤
          try {
            const allEmployees = await getDocs(collection(db, 'employees'));
            debugInfo.push(`\n?뱥 ?꾩껜 吏곸썝 ?? ${allEmployees.size}媛?);
            debugInfo.push(`?뱥 泥섏쓬 10媛?吏곸썝 ID 紐⑸줉:`);
            allEmployees.docs.slice(0, 10).forEach((doc, idx) => {
              const data = doc.data();
              debugInfo.push(`  ${idx + 1}. ID: "${doc.id}", ?대쫫: ${data.name || '?대쫫 ?놁쓬'}`);
            });
          } catch (debugErr) {
            debugInfo.push(`??吏곸썝 紐⑸줉 議고쉶 ?ㅻ쪟: ${debugErr instanceof Error ? debugErr.message : String(debugErr)}`);
          }
          
          setError(`吏곸썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.\n\n${debugInfo.join('\n')}`);
          return;
        }
        
        console.error('??吏곸썝 李얠쓬:', actualEmployeeId, employeeDoc.data().name);
        setEmployee({
          id: employeeDoc.id,
          ...employeeDoc.data()
        } as Employee);

        // 湲됱뿬 ?곗씠??濡쒕뱶 - ?ㅼ젣 employeeId濡?議고쉶
        console.log('?뮥 湲됱뿬 ?곗씠??議고쉶:', { actualEmployeeId, month });
        const payrollQuery = query(
          collection(db, 'confirmedPayrolls'),
          where('employeeId', '==', actualEmployeeId),
          where('month', '==', month)
        );
        const payrollSnapshot = await getDocs(payrollQuery);
        
        console.log('?뮥 湲됱뿬 ?곗씠??議고쉶 寃곌낵:', payrollSnapshot.size, '媛?);
        
        if (payrollSnapshot.empty) {
          console.error('??湲됱뿬 ?곗씠???놁쓬:', { employeeId, month });
          setError('湲됱뿬 ?곗씠?곕? 李얠쓣 ???놁뒿?덈떎.');
          return;
        }

        const payrollData = payrollSnapshot.docs[0].data();
        
        // ?뵏 蹂댁븞: ?좏겙??month? ?ㅼ젣 ?곗씠?곗쓽 month媛 ?쇱튂?섎뒗吏 寃利?        if (payrollData.month !== month) {
          setError('?붿껌???붿쓽 湲됱뿬 ?곗씠?곕? 李얠쓣 ???놁뒿?덈떎.');
          return;
        }

        const calculations = payrollData.calculations || [];
        
        const totalGrossPay = calculations.reduce((sum: number, calc: any) => sum + (calc.grossPay || 0), 0);
        const totalDeductions = calculations.reduce((sum: number, calc: any) => {
          const deductions = calc.deductions;
          if (typeof deductions === 'object' && deductions !== null && 'total' in deductions) {
            return sum + (deductions.total || 0);
          }
          return sum + (typeof deductions === 'number' ? deductions : 0);
        }, 0);
        const totalNetPay = calculations.reduce((sum: number, calc: any) => sum + (calc.netPay || 0), 0);

        setPayroll({
          id: payrollSnapshot.docs[0].id,
          ...payrollData,
          totalGrossPay,
          totalDeductions,
          totalNetPay
        } as ConfirmedPayroll);

        // 洹쇰Т?쒓컙 鍮꾧탳 ?곗씠??濡쒕뱶
        const comparisonsQuery = query(
          collection(db, 'workTimeComparisonResults'),
          where('employeeId', '==', actualEmployeeId),
          where('month', '==', month)
        );
        const comparisonsSnapshot = await getDocs(comparisonsQuery);
        
        const comparisonsData = comparisonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkTimeComparisonResult[];
        
        setWorkTimeComparisons(comparisonsData);

        // 吏??紐⑸줉 濡쒕뱶
        const branchesSnapshot = await getDocs(collection(db, 'branches'));
        const branchesData = branchesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || ''
        }));
        setBranches(branchesData);
      } catch (err) {
        console.error('???곗씠??濡쒕뱶 ?ㅽ뙣:', err);
        console.error('???ㅻ쪟 ?곸꽭:', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        });
        setError(`?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [resolvedParams.employeeId, searchParams]);

  // PDF ?ㅼ슫濡쒕뱶
  const handleDownloadPDF = async () => {
    if (!payroll || !employee) {
      alert('?곗씠?곕? 遺덈윭?????놁뒿?덈떎.');
      return;
    }

    try {
      const element = document.getElementById('payroll-statement-content');
      if (!element) {
        alert('PDF ?앹꽦 ????붿냼瑜?李얠쓣 ???놁뒿?덈떎.');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            *, *::before, *::after {
              color: #000000 !important;
              background-color: #ffffff !important;
              border-color: #d1d5db !important;
              background-image: none !important;
              box-shadow: none !important;
            }
            .bg-gray-50, [class*="bg-gray-50"] { background-color: #f9fafb !important; }
            .bg-gray-100, [class*="bg-gray-100"] { background-color: #f3f4f6 !important; }
            .bg-gray-200, [class*="bg-gray-200"] { background-color: #e5e7eb !important; }
            .bg-blue-50, [class*="bg-blue-50"] { background-color: #eff6ff !important; }
            .text-gray-600, [class*="text-gray-600"] { color: #4b5563 !important; }
            .text-gray-700, [class*="text-gray-700"] { color: #374151 !important; }
            .text-gray-800, [class*="text-gray-800"] { color: #1f2937 !important; }
            .text-gray-900, [class*="text-gray-900"] { color: #111827 !important; }
            .text-blue-600, [class*="text-blue-600"] { color: #2563eb !important; }
            .text-red-600, [class*="text-red-600"] { color: #dc2626 !important; }
            .border-gray-200, [class*="border-gray-200"] { border-color: #e5e7eb !important; }
            .border-gray-300, [class*="border-gray-300"] { border-color: #d1d5db !important; }
            .border-gray-400, [class*="border-gray-400"] { border-color: #9ca3af !important; }
            table { border-collapse: collapse !important; }
            td, th { border: 1px solid #d1d5db !important; }
          `;
          clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`湲됱뿬紐낆꽭??${employee.name}_${payroll.month}.pdf`);
    } catch (err) {
      console.error('PDF ?앹꽦 ?ㅽ뙣:', err);
      alert('PDF ?앹꽦???ㅽ뙣?덉뒿?덈떎.');
    }
  };

  if (loading) {
    console.log('??濡쒕뵫 以?..');
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">濡쒕뵫 以?..</div>
      </div>
    );
  }

  if (error || !employee || !payroll) {
    console.log('???먮윭 ?먮뒗 ?곗씠???놁쓬:', { error, hasEmployee: !!employee, hasPayroll: !!payroll });
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <div className="text-red-600 whitespace-pre-line font-mono text-sm max-w-4xl bg-red-50 p-4 rounded border border-red-200">
          {error || '?곗씠?곕? 遺덈윭?????놁뒿?덈떎.'}
        </div>
      </div>
    );
  }

  const employmentType = (payroll as any).employmentType || (employee as any).employmentType || '';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg p-6 mb-4">
          <div className="flex justify-between items-center">
