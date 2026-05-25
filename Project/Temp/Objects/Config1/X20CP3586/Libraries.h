/* Automation Studio generated header file */
/* Do not edit ! */

#ifndef _LIBRARIES_20260429145308_
#define _LIBRARIES_20260429145308_

__asm__(".section \".plc\"");

/* Used IEC files */
__asm__(".ascii \"iecfile \\\"Logical/Libraries/FileIO/FileIO.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/FileIO/FileIO.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/FileIO/FileIO.var\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/runtime/runtime.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/runtime/runtime.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/runtime/runtime.var\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/sys_lib/sys_lib.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/sys_lib/sys_lib.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/sys_lib/sys_lib.var\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsBrStr/AsBrStr.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsBrStr/AsBrStr.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsBrStr/AsBrStr.var\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsIOVib/AsIOVib.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsIOVib/AsIOVib.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsIOVib/AsIOVib.var\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsFltGen/AsFltGen.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsFltGen/AsFltGen.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsFltGen/AsFltGen.var\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/brsystem/brsystem.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/brsystem/brsystem.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/brsystem/brsystem.var\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsIOAcc/AsIOAcc.fun\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsIOAcc/AsIOAcc.typ\\\" scope \\\"global\\\"\\n\"");
__asm__(".ascii \"iecfile \\\"Logical/Libraries/AsIOAcc/AsIOAcc.var\\\" scope \\\"global\\\"\\n\"");

/* Exported library functions and function blocks */
#ifdef _FILEIO_EXPORT
	__asm__(".ascii \"plcexport \\\"FileCreate\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileOpen\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileClose\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileRead\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileReadEx\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileWrite\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileWriteEx\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileRename\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileCopy\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileDelete\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileTruncate\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirCreate\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirOpen\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirClose\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirRead\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirReadEx\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirRename\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirCopy\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirDelete\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DirDeleteEx\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"SetAttributes\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"GetAttributes\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DevMemInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DevLink\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"DevUnlink\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"GetVolumeLabel\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"GetVolumeSerialNo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"FileIoGetSysError\\\" FUN\\n\"");
#endif
#ifdef _RUNTIME_EXPORT
	__asm__(".ascii \"plcexport \\\"r_trig\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"f_trig\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"rf_trig\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"GetTime\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SFCActionControl\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"SFCAC2\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"RealTan\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealAtan\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealAsin\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealAcos\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealExp\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealLn\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealLog\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealExpt\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealAbs\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealSin\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealCos\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RealSqrt\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SFCAC3\\\" FUB\\n\"");
#endif
#ifdef _SYS_LIB_EXPORT
	__asm__(".ascii \"plcexport \\\"Byte2Bit\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"Bit2Byte\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"KEY_read\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"KEY_enadis\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_fix\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_info\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_copy\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_store\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_burn\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_delete\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_ident\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_read\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_write\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DA_create\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DIS_clr\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DIS_chr\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"DIS_str\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ERRxfatal\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ERR_read\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ERRxread\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ERR_fatal\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ERR_warning\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ERRxwarning\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SM_release\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SM_attach\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SM_delete\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SM_ident\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SM_create\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"TIM_ticks\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"TIM_musec\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SW_settime\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SW_gettime\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RTC_settime\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RTC_gettime\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"TMP_free\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"TMP_alloc\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"MEM_free\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"MEM_alloc\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"AVT_info\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"AVT_release\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"AVT_attach\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"AVT_ident\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"AVT_cancel\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"AVT_create\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_sleep\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_exit\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_freemsg\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_recmsg\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_sendmsg\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_resume\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_suspend\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"UT_ident\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_name\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_info\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_allsuspend\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_tmp_resume\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_tmp_suspend\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_resume\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_suspend\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"ST_ident\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"FORCE_info\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"MO_ver\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"MO_list\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"MO_info\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"SYS_battery\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SYSreset\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SYSxinfo\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"SYS_info\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_xlist\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_ninfo\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_item\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_ident\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_list\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_info\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_xgetval\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_xsetval\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_xgetadr\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_getadr\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_getval\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"PV_setval\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"slMoList\\\" FUB\\n\"");
#endif
#ifdef _ASBRSTR_EXPORT
	__asm__(".ascii \"plcexport \\\"brsftoa\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsatof\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsatod\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsitoa\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsatoi\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsmemset\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsmemcpy\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsmemmove\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsmemcmp\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsstrcat\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsstrlen\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsstrcpy\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"brsstrcmp\\\" FUN\\n\"");
#endif
#ifdef _ASIOVIB_EXPORT
	__asm__(".ascii \"plcexport \\\"vbioCM4810\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"vbioCtrlCM4810\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"vbioCtrlCM4810Ex1\\\" FUB\\n\"");
#endif
#ifdef _ASFLTGEN_EXPORT
	__asm__(".ascii \"plcexport \\\"fltRead\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"fltWrite\\\" FUB\\n\"");
#endif
#ifdef _BRSYSTEM_EXPORT
	__asm__(".ascii \"plcexport \\\"MEMInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"MEMxInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"SysInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"RTInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"TARGETInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"HWInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"SysconfInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"SysconfSet\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"BatteryInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"EXCInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"ZYKVLenable\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"PMemGet\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"PMemPut\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"PMemSize\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"ARwinWindowsInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"ARwinEthWinInfo\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"RTTolerance\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RTCyclic\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RTInit\\\" FUN\\n\"");
	__asm__(".ascii \"plcexport \\\"RTExit\\\" FUN\\n\"");
#endif
#ifdef _ASIOACC_EXPORT
	__asm__(".ascii \"plcexport \\\"AsIOAccRead\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"AsIOAccWrite\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"AsIOAccReadReg\\\" FUB\\n\"");
	__asm__(".ascii \"plcexport \\\"AsIOAccWriteReg\\\" FUB\\n\"");
#endif

__asm__(".previous");


#endif /* _LIBRARIES_20260429145308_ */

