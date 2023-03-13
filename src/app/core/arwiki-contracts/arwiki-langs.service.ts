import { Injectable } from '@angular/core';
import { ArwikiTokenContract } from './arwiki-token.service';
import { WarpContractsService } from '../warp-contracts.service';
import { JWKInterface } from 'arweave/web/lib/wallet';
import { ArwikiLang } from '../interfaces/arwiki-lang';
import { Observable, map } from 'rxjs';
import { ArwikiLangIndex } from '../interfaces/arwiki-lang-index';

@Injectable({
  providedIn: 'root'
})
export class ArwikiTokenLangsService {
  constructor(
    private _arwikiToken: ArwikiTokenContract,
    private _warp: WarpContractsService) { }

  /*
  *  @dev Get languages
  */
  getLanguages(onlyActive = true, reload = false): Observable<ArwikiLangIndex> {
    return this._arwikiToken.getState(reload).pipe(
      map((_state: any) => {
        const languages: ArwikiLangIndex = Object
          .keys(_state.languages)
          .reduce((accum: ArwikiLangIndex, code)=> {
              if (_state.languages[code].active && onlyActive) {
                accum[code] = _state.languages[code];
                accum[code].code = code;
              } else {
                accum[code] = _state.languages[code];
                accum[code].code = code;
              }
              return accum;
            }, {});

        return languages;
      })
    );
  }

  addLanguage(
    _code: string,
    _writingSystem: string,
    _nativeName: string,
    _isoName: string,
    _privateKey: JWKInterface|'use_wallet',
    _arwikiVersion: string
  ) {
    const jwk = _privateKey;
    const tags = [
      {name: 'Service', value: 'ArWiki'},
      {name: 'Arwiki-Type', value: 'AddLanguage'},
      {name: 'Arwiki-Version', value: _arwikiVersion},
    ];
    const input = {
      function: 'addLanguage',
      langCode: _code,
      writingSystem: _writingSystem,
      isoName: _isoName,
      nativeName: _nativeName
    };
    
    return this._warp.writeInteraction(
      this._arwikiToken.contractAddress, jwk, input, tags
    );
  }

  /*
  *  @dev Get Lang
  */
  getLanguagesFromLocal(): ArwikiLangIndex {
    const state = this._arwikiToken.getStateFromLocal();
    return {...state.languages};
  }


}
