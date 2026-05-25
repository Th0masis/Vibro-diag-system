
PROGRAM _INIT
	(* Enable function block *)
	fubCM4810.enable := TRUE;

	(* Set array pointers - these stay constant *)
	fubCM4810.paramBufferUpload.pArrayXaxis := ADR(gTrace.xAxis);
	fubCM4810.paramBufferUpload.pArrayYaxis := ADR(gTrace.yAxis);

	(* Module path pointer - points directly to OPC UA BufferUpload structure *)
	fubCM4810.paramMain.pModulePath := ADR(gTrace.BufferUpload.ModulePath);

	(* NOTE: BufferNumber, BufferLength configured dynamically in _CYCLIC from BufferUpload command *)

END_PROGRAM

PROGRAM _CYCLIC
	(* First scan initialization - runs once after download *)
	IF NOT bInitialized THEN
		stMachine := 0;
		gTrace.BufferStatus.Done := FALSE;
		gTrace.BufferStatus.Busy := FALSE;
		gTrace.BufferStatus.Error := FALSE;
		gTrace.BufferStatus.Progress := 0;
		gTrace.BufferStatus.CurrentWorkID := '';
		bInitialized := TRUE;
	END_IF;
	
	CASE stMachine OF
		0: (* IDLE - Wait for job from API via OPC UA *)
			fubCM4810.requestBufferLock := FALSE;
			fubCM4810.uploadBuffer := FALSE;

			IF gTrace.BufferUpload.Start THEN
				(* Load job configuration from OPC UA *)
				gTrace.BufferStatus.CurrentWorkID := gTrace.BufferUpload.WorkID;

				(* Configure buffer download parameters *)
				fubCM4810.paramBufferUpload.moduleBuffer := gTrace.BufferUpload.BufferNumber;
				fubCM4810.paramBufferUpload.nrArrayElements := gTrace.BufferUpload.BufferLength;

				(* Set status *)
				gTrace.BufferStatus.Busy := TRUE;
				gTrace.BufferStatus.Done := FALSE;
				gTrace.BufferStatus.Error := FALSE;
				gTrace.BufferStatus.Progress := 0;

				(* Reset start trigger *)
				gTrace.BufferUpload.Start := FALSE;

				stMachine := 1;
			END_IF;

		1: (* LOCK BUFFERS *)
			fubCM4810.requestBufferLock := TRUE;
			gTrace.BufferStatus.Progress := 10;

			IF fubCM4810.bufferLockValid = TRUE THEN
				stMachine := 2;
			END_IF;

		2: (* DOWNLOAD BUFFER *)
			fubCM4810.uploadBuffer := TRUE;
			gTrace.BufferStatus.Progress := 50;

			IF fubCM4810.bufferUploadDone = TRUE THEN
				fubCM4810.uploadBuffer := FALSE;
				stMachine := 3;
			END_IF;

		3: (* TRIGGER CSV EXPORT *)
			gTrace.CSVExport := CSV_REQUESTED;
			gTrace.BufferStatus.Progress := 70;
			stMachine := 4;

		4: (* WAIT FOR CSV COMPLETION *)
			IF gTrace.CSVExport = CSV_COMPLETED THEN
				gTrace.CSVExport := CSV_IDLE;  (* Reset for next job *)
				stMachine := 5;
			ELSIF gTrace.CSVExport = CSV_ERROR THEN
				(* CSV export failed *)
				gTrace.BufferStatus.Error := TRUE;
				gTrace.BufferStatus.ErrorID := 9000;  (* Custom error: CSV export failed *)
				gTrace.CSVExport := CSV_IDLE;
				stMachine := 5;
			END_IF;

		5: (* UNLOCK BUFFERS *)
			fubCM4810.requestBufferLock := FALSE;
			gTrace.BufferStatus.Progress := 90;

			IF fubCM4810.bufferLockValid = FALSE THEN
				gTrace.BufferStatus.Progress := 100;
				gTrace.BufferStatus.Done := TRUE;
				gTrace.BufferStatus.Busy := FALSE;
				stMachine := 6;
			END_IF;

		6: (* COMPLETED - Wait for Reset from API *)
			IF gTrace.BufferUpload.Reset THEN
				gTrace.BufferStatus.Done := FALSE;
				gTrace.BufferStatus.Busy := FALSE;
				gTrace.BufferStatus.Progress := 0;
				gTrace.BufferStatus.CurrentWorkID := '';
				gTrace.BufferUpload.Reset := FALSE;
				stMachine := 0;
			END_IF;
	END_CASE;

	(* Update error status *)
	IF fubCM4810.status <> 0 THEN
		gTrace.BufferStatus.Error := TRUE;
		gTrace.BufferStatus.ErrorID := fubCM4810.status;
	ELSE
		gTrace.BufferStatus.Error := FALSE;
		gTrace.BufferStatus.ErrorID := 0;
	END_IF;

	(* Execute function block *)
	fubCM4810();

END_PROGRAM

PROGRAM _EXIT
	(* Insert code here *)
	 
END_PROGRAM

