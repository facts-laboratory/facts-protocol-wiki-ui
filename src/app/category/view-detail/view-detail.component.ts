import { Component, OnInit, OnDestroy } from '@angular/core';
import { ArwikiQuery } from '../../core/arwiki-query';
import { ArweaveService } from '../../core/arweave.service';
import { Subscription, of } from 'rxjs';
import { ArwikiSettingsContract } from '../../arwiki-contracts/arwiki-settings';
import { ArwikiCategoriesContract } from '../../arwiki-contracts/arwiki-categories';
import { MatSnackBar } from '@angular/material/snack-bar';
import { getVerification } from "arverify";
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { switchMap } from 'rxjs/operators';

@Component({
  templateUrl: './view-detail.component.html',
  styleUrls: ['./view-detail.component.scss']
})
export class ViewDetailComponent implements OnInit {
  arwikiQuery!: ArwikiQuery;
  pagesSubscription: Subscription = Subscription.EMPTY;
  loadingPages: boolean = false;
  category: string = '';
  pages: any[] = [];
  routeLang: string = '';
  pagesData: any = {};
  baseURL: string = this._arweave.baseURL;
  arverifyProcessedAddressesMap: any = {};

  constructor(
  	private _arweave: ArweaveService,
  	private _settingsContract: ArwikiSettingsContract,
    private _categoriesContract: ArwikiCategoriesContract,
  	private _snackBar: MatSnackBar,
  	private _route: ActivatedRoute,
    private _location: Location,
 	) { }

  async ngOnInit() {
    // Init ardb instance
    this.arwikiQuery = new ArwikiQuery(this._arweave.arweave);
  	this.category = this._route.snapshot.paramMap.get('category')!;
    this.routeLang = this._route.snapshot.paramMap.get('lang')!;
    this.loadingPages = true;

    let networkInfo;
    let maxHeight = 0;
    try {
      networkInfo = await this._arweave.arweave.network.getInfo();
      maxHeight = networkInfo.height;
    } catch (error) {
      this.message(error, 'error');
      return;
    }

    this.pagesSubscription = this.getPagesByCategory(
    	this.category,
      this.routeLang,
      maxHeight
    ).subscribe({
    	next: async (pages) => {
    		this.pages = pages;
        this.pagesData = {};
        this.loadingPages = false;

        for (let p of pages) {
          this.pagesData[p.id] = await this._arweave.arweave.transactions.getData(
            p.id, 
            {decode: true, string: true}
          );  
        }

        // Verify addresses 
        // Validate owner address with ArVerify
        this.arverifyProcessedAddressesMap = {};
        for (let p of pages) {
          // Avoid duplicates
          if (
            Object.prototype.hasOwnProperty.call(
              this.arverifyProcessedAddressesMap, 
              p.owner
            )
          ) {
            continue;
          }
          const arverifyQuery = await this.getArverifyVerification(p.owner);
          this.arverifyProcessedAddressesMap[p.owner] = arverifyQuery;
        }
        
    	},
    	error: (error) => {
    		this.message(error, 'error');
    		this.loadingPages = false;
    	}
    });
  }

  slugToLabel(_s: string) {
  	return _s.replace(/_/gi, " ");
  }


  /*
  *	Custom snackbar message
  */
  message(msg: string, panelClass: string = '', verticalPosition: any = undefined) {
    this._snackBar.open(msg, 'X', {
      duration: 8000,
      horizontalPosition: 'center',
      verticalPosition: verticalPosition,
      panelClass: panelClass
    });
  }


  ngOnDestroy() {
  	if (this.pagesSubscription) {
  		this.pagesSubscription.unsubscribe();
  	}

  }


  async getArverifyVerification(_address: string) {
    const verification = await getVerification(_address);

    return ({
      verified: verification.verified,
      icon: verification.icon,
      percentage: verification.percentage
    });
  }

  sanitizeMarkdown(_s: string) {
    _s = _s.replace(/[#*=\[\]]/gi, '')
    let res: string = `${_s.substring(0, 250)} ...`;
    return res;
  }

  
  sanitizeImg(_img: string) {
    let res: string = _img.indexOf('http') >= 0 ?
      _img :
      _img ? `${this.baseURL}${_img}` : '';
    return res;
  }


  goBack() {
    this._location.back();
  }

  /*
  * @dev
  */
  getPagesByCategory(
    _category: string,
    _langCode: string,
    _maxHeight: number,
    _limit: number = 100
  ) {
    let settingsCS: any = {};
    return this._settingsContract.getState()
      .pipe(
        switchMap((settingsContractState) => {
          settingsCS = settingsContractState;
          return this._categoriesContract.getState();
        }),
        switchMap((categoriesContractState) => {
          // Validate category 
          if (!(_category in categoriesContractState)) {
            throw new Error('Invalid category!');
          }

          return this.arwikiQuery.getVerifiedPagesByCategories(
            settingsCS.adminList,
            [_category],
            _langCode,
            _limit,
            _maxHeight
          );
        }),
        switchMap((verifiedPages) => {
          const verifiedPagesList = [];
          for (let p of verifiedPages) {
            const vrfdPageId = this.arwikiQuery.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Id');
            verifiedPagesList.push(vrfdPageId);
          }

          return this.arwikiQuery.getTXsData(verifiedPagesList);
        }),
        switchMap((txs) => {
          const finalRes: any = [];
          for (let p of txs) {
            const title = this.arwikiQuery.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Title');
            const slug = this.arwikiQuery.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Slug');
            const category = this.arwikiQuery.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Category');
            const img = this.arwikiQuery.searchKeyNameInTags(p.node.tags, 'Arwiki-Page-Img');
            const owner = p.node.owner.address;
            const id = p.node.id;
            
            finalRes.push({
              title: title,
              slug: slug,
              category: category,
              img: img,
              owner: owner,
              id: id
            });
            
          }
          return of(finalRes);
        })
      );
  }

}
