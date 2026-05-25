(* ============================================================ *)
(* CSV EXPORT STATE MACHINE - Single state variable for GetBuffer <-> SaveData communication*)

TYPE
	CSVExportState : 
		(
		CSV_IDLE := 0, (* Waiting for export request *)
		CSV_REQUESTED := 1, (* GetBuffer requested export *)
		CSV_PROCESSING := 2, (* SaveData is exporting *)
		CSV_COMPLETED := 3, (* Export done, CSV ready *)
		CSV_ERROR := 4 (* Export failed *)
		);
END_TYPE

(* ============================================================ *)
(* OPC UA COMMAND INTERFACE [API -> PLC] - Write these variables from FastAPI to configure the job*)

TYPE
	BufferUploadCmd : 	STRUCT 
		WorkID : STRING[80] := 'debug_123'; (* Unique job ID: "mach5_sens12_1234567890_raw" *)
		ModulePath : STRING[30] := 'IF3.ST1.IF1.ST2'; (* "IF3.ST1.IF1.ST2" - X2X module path *)
		BufferNumber : USINT := 66; (* Buffer to download: 9,11,13,15,25,27,29,31,66,67,70,71... *)
		BufferLength : UDINT := 4097; (* Number of values: 4097, 8193, or 65535 *)
		Start : BOOL := 0; (* Edge trigger - set TRUE to start job *)
		Reset : BOOL := 0; (* Edge trigger - set TRUE to reset after Done *)
	END_STRUCT;
END_TYPE

(* ============================================================ *)
(* OPC UA STATUS INTERFACE [PLC -> API] - Read these variables from FastAPI to monitor job progress*)

TYPE
	BufferUploadStatus : 	STRUCT 
		CurrentWorkID : STRING[80]; (* Currently processing WorkID *)
		Busy : BOOL := 0; (* TRUE when PLC is working on a job *)
		Done : BOOL := 0; (* TRUE when job completed (CSV ready on FTP) *)
		Error : BOOL := 0; (* TRUE if error occurred *)
		ErrorID : UINT := 0; (* Error code from vbioCM4810.status or custom error *)
		Progress : USINT := 0; (* Job progress: 0-100% *)
		CSVFileName : STRING[100]; (* Name of generated CSV file *)
	END_STRUCT;
END_TYPE

(* ============================================================ *)
(* MAIN STRUCTURE - Global variable gTrace*)

TYPE
	TraceVibro : 	STRUCT  (* OPC UA Interface - API <-> PLC *)
		BufferUpload : BufferUploadCmd;
		BufferStatus : BufferUploadStatus; (* Internal communication - GetBuffer <-> SaveData *)
		CSVExport : CSVExportState; (* Single state variable: IDLE/REQUESTED/PROCESSING/COMPLETED/ERROR *) (* Buffer data storage - max 8193 values *) (* Note: Most CM4810 buffers use 8193 values. Only special cases use 65535. *)
		xAxis : ARRAY[0..8192]OF REAL;
		yAxis : ARRAY[0..8192]OF REAL;
	END_STRUCT;
END_TYPE
